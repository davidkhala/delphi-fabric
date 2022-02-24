import helper from './helper.js';
import {ChannelConfig} from '../common/nodejs/channelConfig.js';
import ConfigFactory from '../common/nodejs/formatter/configFactory.js';

import assert from 'assert';
import {importFrom} from '@davidkhala/light/es6.mjs';
const globalConfig = importFrom('./config/orgs.json');
export const setAnchorPeersByOrg = async (channelName, orgName, orderer, finalityRequired) => {
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
