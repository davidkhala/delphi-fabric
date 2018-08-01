const {randomKeyOf} = require('../common/nodejs/helper');
const {install, instantiateOrUpgrade, invoke} = require('../common/nodejs/chaincode');
const logUtil = require('../common/nodejs/logger');
const ClientUtil = require('../common/nodejs/client');
const ChannelUtil = require('../common/nodejs/channel');
const EventHubUtil = require('../common/nodejs/eventHub');
const golangUtil = require('../common/nodejs/golang');
const PolicyUtil = require('../common/nodejs/Policy');
const path = require('path');


const chaincodeConfig = require('../config/chaincode.json');

exports.install = async (peers, {chaincodeId, chaincodeVersion, chaincodeType}, client) => {
	let chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path;
	if (chaincodeType === 'node') {
		const gopath = await golangUtil.getGOPATH();
		chaincodePath = path.resolve(gopath, 'src', chaincodePath);
	}
	if (chaincodeType === 'golang') {
		await golangUtil.setGOPATH();
	}
	return install(peers, {chaincodeId, chaincodePath, chaincodeVersion, chaincodeType}, client);
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
			collectionSet.push(PolicyUtil.collectionConfig(config));
		}
		result.collectionConfig = collectionSet;
	}
	return result;

};
exports.instantiate = async (channel, richPeers, opts) => {

	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig.chaincodes[chaincodeId]);

	const {eventWaitTime} = channel;

	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}

	const allConfig = Object.assign(policyConfig, opts);
	return instantiateOrUpgrade('deploy', channel, richPeers, eventHubs, allConfig, eventWaitTime);
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
	return instantiateOrUpgrade('upgrade', channel, richPeers, eventHubs, allConfig, eventWaitTime);
};
exports.invoke = async (channel, richPeers, {chaincodeId, fcn, args}, nonAdminUser) => {
	const logger = logUtil.new('invoke-Helper');
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
		return await invoke(channel, richPeers, eventHubs, {chaincodeId, args, fcn}, orderer, eventWaitTime);
	} catch (e) {
		if (e.proposalResponses) {
			throw e.proposalResponses;
		} else throw e;
	}

};