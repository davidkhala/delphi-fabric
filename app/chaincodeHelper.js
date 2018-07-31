const {randomKeyOf} = require('../common/nodejs/helper');
const {install, instantiateOrUpgrade, invoke} = require('../common/nodejs/chaincode');
const logUtil = require('../common/nodejs/logger');
const ClientUtil = require('../common/nodejs/client');
const ChannelUtil = require('../common/nodejs/channel');
const EventHubUtil = require('../common/nodejs/eventHub');
const golangUtil = require('../common/nodejs/golang');
const path = require('path');


exports.install = async (peers, {chaincodeId, chaincodePath, chaincodeVersion, chaincodeType}, client) => {
	if (chaincodeType === 'node') {
		const gopath = await golangUtil.getGOPATH();
		chaincodePath = path.resolve(gopath, 'src', chaincodePath);
	}
	if (chaincodeType === 'golang') {
		await golangUtil.setGOPATH();
	}
	return install(peers, {chaincodeId, chaincodePath, chaincodeVersion, chaincodeType}, client);
};
exports.instantiate = async (channel, richPeers, {chaincodeId, chaincodeVersion, args, fcn, chaincodeType}) => {

	const {eventWaitTime} = channel;

	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}


	return instantiateOrUpgrade('deploy',channel, richPeers, eventHubs, {
		chaincodeId,
		chaincodeVersion,
		args,
		fcn,
		chaincodeType
	}, eventWaitTime);
};

exports.upgrade = async (channel, richPeers, {chaincodeId, chaincodeVersion, args, fcn}) => {
	const {eventWaitTime} = channel;
	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}
	return instantiateOrUpgrade('upgrade',channel, richPeers, eventHubs, {chaincodeId, chaincodeVersion, args, fcn}, eventWaitTime);
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