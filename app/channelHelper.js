const helper = require('./helper.js');
const ChannelUtil = require('../common/nodejs/channel');
const OrdererUtil = require('../common/nodejs/orderer');
const {setAnchorPeers, getChannelConfigReadable, ConfigFactory} = require('../common/nodejs/channelConfig');
const Eventhub = require('../common/nodejs/eventHub');

const {create, join, getGenesisBlock} = ChannelUtil;
const globalConfig = require('../config/orgs');
const {sleep} = require('khala-nodeutils/helper');
/**
 *
 * @param {Client.Channel} channel
 * @param channelConfigFile
 * @param {Orderer} orderer
 * @param {OrgName[]} extraSignerOrgs orgName array of signer
 * @returns {Promise<Client.BroadcastResponse>}
 */
exports.create = async (channel, channelConfigFile, orderer, extraSignerOrgs = []) => {

	const clients = [channel._clientContext];
	// extract the channel config bytes from the envelope to be signed
	for (const orgName of extraSignerOrgs) {
		const signingClient = helper.getOrgAdmin(orgName);
		clients.push(signingClient);
	}

	return create(channel, orderer, channelConfigFile, clients);
};

// could not join peer to system channel 'testchainid'
exports.joinAll = async (channelName) => {

	const channelConfig = globalConfig.channels[channelName];
	const allOrderers = helper.newOrderers();
	const waitForOrderer = async () => {
		const orderers = await OrdererUtil.filter(allOrderers, true);
		if (orderers.length === 0) {
			await sleep(1000);
			return waitForOrderer();
		}
		return orderers[0];
	};
	const orderer = await waitForOrderer();
	let client;
	if (channelName === ChannelUtil.genesis) {
		client = helper.getOrgAdmin(undefined, 'orderer');
	}
	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		client = helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);

		const block = await getGenesisBlock(channel, orderer);
		for (const peer of peers) {
			await join(channel, peer, block);
		}
	}

};
exports.newEventHubs = async (channel, peerIndexes, orgName, inlineConnected = true) => {
	const peers = helper.newPeers(peerIndexes, orgName);

	const eventHubs = peers.map(peer => new Eventhub(channel, peer));
	if (inlineConnected) {
		for (const eventHub of eventHubs) {
			await eventHub.connect();
		}
	}

	return eventHubs;
};

exports.setAnchorPeersByOrg = async (channelName, OrgName) => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const orgConfig = globalConfig.channels[channelName].orgs[OrgName];
	const {anchorPeerIndexes} = orgConfig;
	const client = helper.getOrgAdmin(OrgName);
	const channel = helper.prepareChannel(channelName, client);

	const anchorPeers = [];
	for (const peerIndex of anchorPeerIndexes) {
		const {container_name} = globalConfig.orgs[OrgName].peers[peerIndex];
		anchorPeers.push({host: container_name, port: 7051});
	}
	await setAnchorPeers(channel, orderer, OrgName, anchorPeers);
	// TODO setup eventhub block listener here
	const ordererClient = helper.getOrgAdmin(OrgName, 'orderer');
	ChannelUtil.setClientContext(channel, ordererClient);
	const {configJSON} = await getChannelConfigReadable(channel, {orderer});
	const updatedAnchorPeers = new ConfigFactory(configJSON).getAnchorPeers(OrgName);
	if (JSON.stringify(updatedAnchorPeers) === JSON.stringify(anchorPeers)) {
		throw Error(`{OrgName:${OrgName} anchor peer updated failed: updatedAnchorPeers ${updatedAnchorPeers}`);
	}
};

