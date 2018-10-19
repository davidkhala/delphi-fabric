const {randomKeyOf} = require('../common/nodejs/helper');
const {install, instantiateOrUpgrade, invoke} = require('../common/nodejs/chaincode');
const logUtil = require('../common/nodejs/logger');
const ClientUtil = require('../common/nodejs/client');
const ChannelUtil = require('../common/nodejs/channel');
const EventHubUtil = require('../common/nodejs/eventHub');
const golangUtil = require('../common/nodejs/golang');
const PolicyUtil = require('../common/nodejs/Policy');
const SideDBUtil = require('../common/nodejs/PrivateData');
const path = require('path');
const Query = require('../common/nodejs/query');

const chaincodeConfig = require('../config/chaincode.json');

exports.install = async (peers, {chaincodeId, chaincodeVersion, chaincodeType}, client) => {
	const chaincodeRelPath = chaincodeConfig.chaincodes[chaincodeId].path;
	let metadataPath;
	let chaincodePath;
	if (!chaincodeType) {
		chaincodeType = chaincodeConfig.chaincodes[chaincodeId].type;
	}
	const gopath = await golangUtil.getGOPATH();
	if (chaincodeType === 'node') {
		chaincodePath = path.resolve(gopath, 'src', chaincodeRelPath);
		metadataPath = path.resolve(chaincodePath, 'META-INF');//the name is arbitrary
	}
	if (!chaincodeType || chaincodeType === 'golang') {
		await golangUtil.setGOPATH();
		chaincodePath = chaincodeRelPath;
		metadataPath = path.resolve(gopath, 'src', chaincodeRelPath, 'META-INF');//the name is arbitrary
	}
	if (!chaincodeConfig.chaincodes[chaincodeId].couchDBIndex) {
		metadataPath = undefined;
	}

	return install(peers, {chaincodeId, chaincodePath, chaincodeVersion, chaincodeType, metadataPath}, client);
};

exports.nextVersion = (chaincodeVersion) => {
	const version = parseInt(chaincodeVersion.substr(1));
	return `v${version + 1}`;
};
exports.newerVersion = (versionN, versionO) => {
	const versionNumN = parseInt(versionN.substr(1));
	const versionNumO = parseInt(versionO.substr(1));
	return versionNumN > versionNumO;
};
exports.upgradeToCurrent = async (channel, richPeer, {chaincodeId, args, fcn}) => {
	const client = channel._clientContext;
	const {chaincodes} = await Query.chaincodes.installed(richPeer, client);
	const foundChaincode = chaincodes.find((element) => element.name === chaincodeId);
	if (!foundChaincode) {
		throw `No chaincode found with name ${chaincodeId}`;
	}
	const {version} = foundChaincode;

	// [ { name: 'adminChaincode',
	// 	version: 'v0',
	// 	path: 'github.com/admin',
	// 	input: '',
	// 	escc: '',
	// 	vscc: '' } ]

	const chaincodeVersion = exports.nextVersion(version);
	return exports.upgrade(channel, [richPeer], {chaincodeId, args, chaincodeVersion, fcn}, client);
};

exports.updateInstall = async (peer, {chaincodeId, chaincodePath}, client) => {
	const logger = logUtil.new('update install');
	const {chaincodes} = await Query.chaincodes.installed(peer, client);
	const foundChaincodes = chaincodes.filter((element) => element.name === chaincodeId);
	let chaincodeVersion = 'v0';
	if (foundChaincodes.length === 0) {
		logger.warn(`No chaincode found with name ${chaincodeId}, to use version ${chaincodeVersion}, `, {chaincodePath});
	} else {
		let latestChaincode = foundChaincodes[0];
		let latestVersion = latestChaincode.version;
		for (const chaincode of foundChaincodes) {
			const {version} = chaincode;
			if (exports.newerVersion(version, latestVersion)) {
				latestVersion = version;
				latestChaincode = chaincode;
			}
		}
		chaincodePath = latestChaincode.path;
		chaincodeVersion = exports.nextVersion(latestVersion);
	}

	// [ { name: 'adminChaincode',
	// 	version: 'v0',
	// 	path: 'github.com/admin',
	// 	input: '',
	// 	escc: '',
	// 	vscc: '' } ]

	return exports.install([peer], {chaincodeId, chaincodePath, chaincodeVersion}, client);

};
const buildPolicy = (config) => {
	const {n} = config;
	const identities = [];
	for (const [mspid, isAdmin] of Object.entries(config.mspId)) {
		identities.push(PolicyUtil.RoleIdentity(mspid, isAdmin));
	}
	return PolicyUtil.simplePolicyBuilder(identities, n);
};
/**
 * this should apply to both instantiate and upgrade
 */
const configParser = (config) => {
	const {endorsingConfigs, collectionConfigs} = config;
	const result = {};
	if (endorsingConfigs) {
		result.endorsementPolicy = buildPolicy(endorsingConfigs);
	}
	if (collectionConfigs) {
		const collectionSet = [];
		for (const [name, config] of Object.entries(collectionConfigs)) {
			const policy = buildPolicy(config.policy);
			config.name = name;
			config.policy = policy;
			collectionSet.push(SideDBUtil.collectionConfig(config));
		}
		result.collectionConfig = collectionSet;
	}
	return result;

};
const defaultProposalTime = 45000;
exports.instantiate = async (channel, richPeers, opts) => {
	const logger = logUtil.new('instantiate-Helper', true);
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig.chaincodes[chaincodeId]);

	const {eventWaitTime} = channel;

	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}

	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeout = richPeers.length * defaultProposalTime;
	return instantiateOrUpgrade('deploy', channel, richPeers, eventHubs, allConfig, eventWaitTime, proposalTimeout);
};

exports.upgrade = async (channel, richPeers, opts) => {
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig.chaincodes[chaincodeId]);

	const {eventWaitTime} = channel;
	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}
	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeout = richPeers.length * defaultProposalTime;
	return instantiateOrUpgrade('upgrade', channel, richPeers, eventHubs, allConfig, eventWaitTime, proposalTimeout);
};
exports.invoke = async (channel, richPeers, {chaincodeId, fcn, args, transientMap}, nonAdminUser) => {
	const logger = logUtil.new('invoke-Helper', true);
	const {eventWaitTime} = channel;
	const eventHubs = [];
	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}
	const orderers = channel.getOrderers();
	const orderer = orderers[randomKeyOf(orderers)];
	if (nonAdminUser) {
		const client = ClientUtil.new();
		await client.setUserContext(nonAdminUser, true);
		ChannelUtil.setClientContext(channel, client);
	}

	try {
		return await invoke(channel, richPeers, eventHubs, {
			chaincodeId,
			args,
			fcn,
			transientMap,
		}, orderer, eventWaitTime,);
	} catch (e) {
		for (const eventHub of eventHubs) {
			eventHub.close();
		}
		if (e.proposalResponses) {
			throw e.proposalResponses;
		} else throw e;
	}

};