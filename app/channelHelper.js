const helper = require('./helper.js');
const {ChannelConfig} = require('../common/nodejs/channelConfig');
const ConfigFactory = require('../common/nodejs/formatter/configFactory');
const globalConfig = require('../config/orgs');
const assert = require('assert');

exports.setAnchorPeersByOrg = async (channelName, orgName, orderer, finalityRequired) => {
	const orgConfig = globalConfig.channels[channelName].organizations[orgName];
	const {anchorPeerIndexes} = orgConfig;
	const user = helper.getOrgAdmin(orgName);

	const anchorPeers = anchorPeerIndexes.map(peerIndex => {
		const {container_name} = globalConfig.organizations[orgName].peers[peerIndex];
		return {host: container_name, port: 7051};
	});

	const channelConfig = new ChannelConfig(channelName, user, orderer);
	await channelConfig.setAnchorPeers(undefined, orgName, anchorPeers, !!finalityRequired);
	if (finalityRequired) {
		const {json} = await channelConfig.getChannelConfigReadable();
		const updatedAnchorPeers = new ConfigFactory(json).getAnchorPeers(orgName);

		assert.deepStrictEqual(updatedAnchorPeers.value.anchor_peers, anchorPeers);
	}

};
