const {randomKeyOf} = require('../common/nodejs/helper');
const {install, instantiate, upgrade, invoke, Policy} = require('../common/nodejs/chaincode');
const logUtil = require('../common/nodejs/logger');
const ClientUtil = require('../common/nodejs/client');
const ChannelUtil = require('../common/nodejs/channel');
const EventHubUtil = require('../common/nodejs/eventHub');
const golangUtil = require('../common/nodejs/golang');
const path = require('path');
exports.endorsementPolicySamples = () => {

	const {Role, OrganizationUnit, Identity} = Policy.IDENTITY_TYPE; // TODO only option 'Role' has been implemented
	const roleType = 'member'; //member|admin

	/*
	{
	    identities: [
	      { role: { name: "member", mspId: "org1" }},
	      { role: { name: "member", mspId: "org2" }}
	    ],
	    policy: {
	      "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]
	    }
	  }
	 */

	/*
	{
	    identities: [
	      { role: { name: "member", mspId: "peerOrg1" }},
	      { role: { name: "member", mspId: "peerOrg2" }},
	      { role: { name: "admin", mspId: "ordererOrg" }}
	    ],
	    policy: {
	      "2-of": [
	        { "signed-by": 2},
	        { "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]}
	      ]
	    }
	  }
	 */
};
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
	const logger = logUtil.new('instantiate-Helper');

	const {eventWaitTime} = channel;

	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer);
		eventHubs.push(eventHub);
	}


	return instantiate(channel, richPeers, eventHubs, {
		chaincodeId,
		chaincodeVersion,
		args,
		fcn,
		chaincodeType
	}, eventWaitTime);
};

exports.upgrade = async (channel, richPeers, {chaincodeId, chaincodeVersion, args, fcn}) => {
	const logger = logUtil.new('upgrade-Helper');
	const {eventWaitTime} = channel;
	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer);
		eventHubs.push(eventHub);
	}
	return upgrade(channel, richPeers, eventHubs, {chaincodeId, chaincodeVersion, args, fcn}, eventWaitTime);
};
exports.invoke = async (channel, richPeers, {chaincodeId, fcn, args}, nonAdminUser) => {
	const logger = logUtil.new('invoke-Helper');
	const {eventWaitTime} = channel;
	const eventHubs = [];
	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer);
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