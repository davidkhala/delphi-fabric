const helper = require('./helper');
const globalConfig = require('../config/orgs.json');
const logger = require('../common/nodejs/logger').new('testUpgrade');
const Query = require('../common/nodejs/query');
const {updateInstall, nextVersion, upgrade} = require('../common/nodejs/chaincode');

const chaincodeId = process.env.name ? process.env.name : 'adminChaincode';

const EventHubUtil = require('../common/nodejs/eventHub');
const args = [];

const channelName = 'allchannel';
const updateInstallAll = async () => {
	const orgsConfig = globalConfig.channels[channelName].orgs;
	for (const orgName in orgsConfig) {
		const {peerIndexes} = orgsConfig[orgName];
		const client = await helper.getOrgAdmin(orgName);
		const peers = helper.newPeers(peerIndexes, orgName);
		for (const peer of peers) {
			await updateInstall(peer, {chaincodeId}, client);
		}
	}

};

const task = async () => {
	const peerOrg = helper.randomOrg('peer');
	const peerClient = await helper.getOrgAdmin(peerOrg);
	const peer = helper.newPeers([0], peerOrg)[0];
	const channel = helper.prepareChannel(channelName, peerClient, true);
	const {chaincodes} = await Query.chaincodes.instantiated(peer, channel);
	const foundChaincode = chaincodes.find((element) => {
		return element.name === chaincodeId;
	});
	if (!foundChaincode) {
		logger.error(chaincodeId, 'not found');
		return;
	}
	await updateInstallAll(foundChaincode);


	try {
		const chaincodeVersion = nextVersion(foundChaincode.version);
		const orgName = helper.randomOrg('peer');
		const client = await helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName, client, true);
		const peers = helper.newPeers([0], orgName);
		const eventHubs = [];
		for(const peer of peers){
			const eventHub = await peer.eventHubPromise;
			eventHubs.push(eventHub)
		}
		await upgrade(channel, peers,eventHubs, {chaincodeId, chaincodeVersion, args});
		//	NOTE: found all peers in channel will create chaincode container with new version for each, but the old version chaincode container remains
	} catch (e) {
		logger.error(e);
	}


};
task();


