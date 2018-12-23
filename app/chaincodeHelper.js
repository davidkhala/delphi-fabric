const {randomKeyOf} = require('khala-nodeutils/helper');
const {install,} = require('../common/nodejs/chaincode');
const {instantiateOrUpgrade, invoke} = require('../common/nodejs/chaincodeHelper');
const Logger = require('../common/nodejs/logger');
const ClientUtil = require('../common/nodejs/client');
const ChannelUtil = require('../common/nodejs/channel');
const EventHubUtil = require('../common/nodejs/eventHub');
const golangUtil = require('../common/nodejs/golang');
const {RoleIdentity, simplePolicyBuilder} = require('../common/nodejs/policy');
const {collectionPolicyBuilder, collectionConfig} = require('../common/nodejs/privateData');
const path = require('path');
const Query = require('../common/nodejs/query');

const chaincodeConfig = require('../config/chaincode.json');

const {nextVersion, newerVersion} = require('khala-nodeutils/version');
exports.install = async (peers, {chaincodeId, chaincodeVersion, chaincodeType}, client) => {
	const chaincodeRelPath = chaincodeConfig[chaincodeId].path;
	let metadataPath;
	let chaincodePath;
	if (!chaincodeType) {
		chaincodeType = chaincodeConfig[chaincodeId].type;
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
	if (!chaincodeConfig[chaincodeId].couchDBIndex) {
		metadataPath = undefined;
	}

	return install(peers, {chaincodeId, chaincodePath, chaincodeVersion, chaincodeType, metadataPath}, client);
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

	const chaincodeVersion = nextVersion(version);
	return exports.upgrade(channel, [richPeer], {chaincodeId, args, chaincodeVersion, fcn}, client);
};

exports.incrementInstall = async (peer, {chaincodeId, chaincodePath}, client) => {
	const logger = Logger.new('install patch');
	const {chaincodes} = await Query.chaincodesInstalled(peer, client);
	const foundChaincodes = chaincodes.filter((element) => element.name === chaincodeId);
	let chaincodeVersion = nextVersion();


	const reducer = (lastChaincode, currentValue) => {
		if (!lastChaincode || newerVersion(currentValue.version, lastChaincode.version)) {
			return currentValue;
		} else {
			return lastChaincode;
		}
	};
	const lastChaincode = foundChaincodes.reduce(reducer);
	if (!lastChaincode) {
		logger.warn(`No chaincode found with name ${chaincodeId}, to use version ${chaincodeVersion}, `, {chaincodePath});
	} else {
		chaincodePath = lastChaincode.path;
		chaincodeVersion = nextVersion(lastChaincode.version);
	}

	return exports.install([peer], {chaincodeId, chaincodePath, chaincodeVersion}, client);

};
const buildEndorsePolicy = (config) => {
	const {n} = config;
	const identities = [];
	for (const [mspid, type] of Object.entries(config.mspId)) {
		identities.push(RoleIdentity(mspid, type));
	}
	return simplePolicyBuilder(identities, n);
};
/**
 * this should apply to both instantiate and upgrade
 */
const configParser = (config) => {
	const {endorsingConfigs, collectionConfigs} = config;
	const result = {};
	if (endorsingConfigs) {
		result.endorsementPolicy = buildEndorsePolicy(endorsingConfigs);
	}
	if (collectionConfigs) {
		const collectionSet = [];
		for (const [name, config] of Object.entries(collectionConfigs)) {
			const policy = collectionPolicyBuilder(config.mspIds);
			config.name = name;
			config.policy = policy;
			collectionSet.push(collectionConfig(config));
		}
		result.collectionConfig = collectionSet;
	}
	return result;

};
const defaultProposalTime = 45000;
exports.instantiate = async (channel, richPeers, opts) => {
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig[chaincodeId]);

	const {eventWaitTime} = channel;

	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}

	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeout = richPeers.length * defaultProposalTime;
	return instantiateOrUpgrade('deploy', channel, richPeers, eventHubs, allConfig, proposalTimeout, eventWaitTime,);
};

exports.upgrade = async (channel, richPeers, opts) => {
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig[chaincodeId]);

	const {eventWaitTime} = channel;
	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}
	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeout = richPeers.length * defaultProposalTime;
	return instantiateOrUpgrade('upgrade', channel, richPeers, eventHubs, allConfig, proposalTimeout, eventWaitTime,);
};
exports.invoke = async (channel, richPeers, {chaincodeId, fcn, args, transientMap}, nonAdminUser) => {
	const logger = Logger.new('invoke-Helper', true);
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
		}, orderer);
	} catch (e) {
		if (e.proposalResponses) {
			throw e.proposalResponses;
		} else {
			throw e;
		}
	}

};