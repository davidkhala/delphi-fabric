const helper = require('./helper.js');
const logger = require('../common/nodejs/logger').new('create-Channel');
const ChannelUtil = require('../common/nodejs/channel');
const {newEventHub, blockWaiter} = require('../common/nodejs/eventHub');
const path = require('path');

const {create, join, updateAnchorPeers} = ChannelUtil;
const {genAnchorPeers} = require('../common/nodejs/binManager');

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


const globalConfig = require('../config/orgs');
exports.joinAll = async (channelName) => {

	const channelConfig = globalConfig.channels[channelName];
	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);
		const orderer = await ChannelUtil.getOrderers(channel, true)[0];
		for (const peer of peers) {
			await join(channel, peer, orderer);
		}
	}

};

exports.updateAnchorPeers = async (configtxYaml, channelName, orgName) => {
	const anchorTx = path.resolve(`${orgName}Anchors.tx`);
	await genAnchorPeers(configtxYaml, channelName, orgName, anchorTx);

	const client = await helper.getOrgAdmin(orgName);

	const channel = helper.prepareChannel(channelName, client);
	const orderer = channel.getOrderers()[0];

	const peer = helper.newPeers([0], orgName)[0];
	const eventHub = newEventHub(channel, peer, true);

	await Promise.all([updateAnchorPeers(channel, anchorTx, orderer), blockWaiter(eventHub, 1)]);


};
