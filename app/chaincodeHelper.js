const {install} = require('../common/nodejs/chaincode');
const {ChaincodeType} = require('../common/nodejs/formatter/chaincode');
const {invoke} = require('../common/nodejs/chaincodeHelper');
const {incrementUpgrade} = require('../common/nodejs/chaincodeVersion');
const {transactionProposal} = require('../common/nodejs/builder/transaction');
const ClientManager = require('../common/nodejs/builder/client');
const ChannelManager = require('../common/nodejs/builder/channel');
const Eventhub = require('../common/nodejs/builder/eventHub');
const golangUtil = require('../common/nodejs/golang');
const {RoleIdentity, simplePolicyBuilder} = require('../common/nodejs/policy');
const {collectionPolicyBuilder, ensureCollectionConfig} = require('../common/nodejs/privateData');
const {couchDBIndex} = require('../common/nodejs/couchdb');
const {endorsementHintsBuilder} = require('../common/nodejs/serviceDiscovery');
const path = require('path');

const chaincodeConfig = require('../config/chaincode.json');

exports.prepareInstall = async ({chaincodeId}) => {
	const chaincodeRelativePath = chaincodeConfig[chaincodeId].path;
	let metadataPath;
	let chaincodePath;
	const chaincodeType = chaincodeConfig[chaincodeId].type;
	const gopath = await golangUtil.getGOPATH();
	if (chaincodeType === ChaincodeType.node) {
		chaincodePath = path.resolve(gopath, 'src', chaincodeRelativePath);
		metadataPath = path.resolve(chaincodePath, 'META-INF');// the name is arbitrary
	}
	if (!chaincodeType || chaincodeType === ChaincodeType.golang) {
		await golangUtil.setGOPATH();
		chaincodePath = chaincodeRelativePath;
		metadataPath = path.resolve(gopath, 'src', chaincodeRelativePath, 'META-INF');// the name is arbitrary
	}
	if (Array.isArray(chaincodeConfig[chaincodeId].couchDBIndexes)) {
		couchDBIndex(metadataPath, undefined, ...chaincodeConfig[chaincodeId].couchDBIndexes);
	} else {
		metadataPath = undefined;
	}
	return {chaincodeId, chaincodePath, chaincodeType, metadataPath};
};
exports.install = async (peers, {chaincodeId, chaincodeVersion}, client) => {
	const opt = await exports.prepareInstall({chaincodeId});
	opt.chaincodeVersion = chaincodeVersion;
	return install(peers, opt, client);
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
const configParser = (configs) => {
	const {endorsingConfigs, collectionsConfig} = configs;
	const result = {};
	if (endorsingConfigs) {
		result.endorsementPolicy = buildEndorsePolicy(endorsingConfigs);
	}
	if (collectionsConfig) {
		const collectionSet = [];
		for (const [name, config] of Object.entries(collectionsConfig)) {
			const policy = collectionPolicyBuilder(config.mspIds);
			config.name = name;
			config.policy = policy;
			collectionSet.push(ensureCollectionConfig(config));
		}
		result.collectionConfig = collectionSet;
	}
	return result;

};

exports.upgrade = async (channel, richPeers, opts, orderer) => {
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig[chaincodeId]);

	const eventHubs = richPeers.map(peer => new Eventhub(channel, peer));

	for (const eventHub of eventHubs) {
		await eventHub.connect();
	}
	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeOut = process.env.ci ? 60000 * richPeers.length : undefined;
	try {
		return await incrementUpgrade(channel, richPeers, eventHubs, allConfig, orderer, proposalTimeOut);
	} catch (e) {
		for (const eventHub of eventHubs) {
			eventHub.disconnect();
		}
		throw e;
	}

};
exports.invoke = async (channel, peers, orderer, {chaincodeId, fcn, args, transientMap}, nonAdminUser, eventHubs) => {
	if (!eventHubs) {
		eventHubs = peers.map(peer => new Eventhub(channel, peer));
		for (const eventHub of eventHubs) {
			await eventHub.connect();
		}
	}
	const client = channel._clientContext;
	if (nonAdminUser) {
		ClientManager.setUser(client, nonAdminUser);
		ChannelManager.setClientContext(channel, client);
	}


	return await invoke(client, channel.getName(), peers, eventHubs, {
		chaincodeId,
		args,
		fcn,
		transientMap
	}, orderer);

};

exports.discoveryChaincodeInterestBuilder = (chaincodeIdFilter) => {
	let chaincodes = [];
	for (const [chaincodeID, config] of Object.entries(chaincodeConfig)) {
		if (typeof chaincodeIdFilter === 'function' && !chaincodeIdFilter(chaincodeID)) {
			continue;
		}
		const {collectionsConfig} = config;
		if (collectionsConfig) {
			const ccCalls = endorsementHintsBuilder({[chaincodeID]: Object.keys(collectionsConfig)});
			chaincodes = chaincodes.concat(ccCalls);
		}
	}
	return {chaincodes};
};
exports.query = async (channel, peers, {chaincodeId, fcn, args, transientMap}, proposalTimeout = 30000) => {
	const client = channel._clientContext;
	return transactionProposal(client, peers, channel.getName(), {
		chaincodeId,
		fcn,
		args,
		transientMap
	}, proposalTimeout);
};
