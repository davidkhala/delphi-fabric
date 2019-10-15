const helper = require('./helper.js');
const ChannelUtil = require('../common/nodejs/channel');
const {setupAnchorPeers, setAnchorPeers} = require('../common/nodejs/channelConfig');
const {newEventHub, blockWaiter} = require('../common/nodejs/eventHub');

const {create, join, getGenesisBlock} = ChannelUtil;
const BinManager = require('../common/nodejs/binManager');
const globalConfig = require('../config/orgs');
const {sleep} = require('../common/nodejs');
/**
 *
 * @param {Channel} channel
 * @param channelConfigFile
 * @param {Orderer} orderer
 * @param {string[]} extraSignerOrgs orgName array of signer
 * @returns {Promise<T>}
 */
exports.create = async (channel, channelConfigFile, orderer, extraSignerOrgs = []) => {

	const clients = [channel._clientContext];
	// extract the channel config bytes from the envelope to be signed
	for (const orgName of extraSignerOrgs) {
		const signingClient = await helper.getOrgAdmin(orgName);
		clients.push(signingClient);
	}

	return create(clients, channel, channelConfigFile, orderer);
};


exports.joinAll = async (channelName) => {

	const channelConfig = globalConfig.channels[channelName];
	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);

		const waitForOrderer = async () => {
			const orderers = await ChannelUtil.getOrderers(channel, true);
			if (orderers.length === 0) {
				await sleep(1000);
				return waitForOrderer();
			}
			return orderers[0];
		};
		const orderer = await waitForOrderer();
		const block = await getGenesisBlock(channel, orderer);
		for (const peer of peers) {
			await join(channel, peer, block);
		}
	}

};
exports.newEventHubs = async (channel, peerIndexes, orgName, inlineConnected = true) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	return peers.map(peer => {
		return newEventHub(channel, peer, inlineConnected);
	});
};

exports.setAnchorPeersByOrg = async (channelName, OrgName) => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const orgConfig = globalConfig.channels[channelName].orgs[OrgName];
	const {anchorPeerIndexes} = orgConfig;
	const client = await helper.getOrgAdmin(OrgName);
	const channel = helper.prepareChannel(channelName, client);

	const anchorPeers = [];
	for (const peerIndex of anchorPeerIndexes) {
		const {container_name} = globalConfig.orgs[OrgName].peers[peerIndex];
		anchorPeers.push({host: container_name, port: 7051});
	}
	await setAnchorPeers(channel, orderer, OrgName, anchorPeers);
};

exports.setupAnchorPeersFromFile = async (configtxYaml, channelName, orgName) => {
	const anchorTx = helper.projectResolve('config', 'configtx', `${orgName}Anchors.tx`);
	const binManager = new BinManager();
	await binManager.configtxgen('anchorPeers', configtxYaml, channelName).genAnchorPeers(anchorTx, orgName);

	const client = await helper.getOrgAdmin(orgName);

	const channel = helper.prepareChannel(channelName, client);
	const orderer = channel.getOrderers()[0];
	await setupAnchorPeers(channel, orderer, anchorTx);
};
