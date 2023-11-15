import * as helper from './helper.js';
import {ChannelConfig} from '../common/nodejs/channelConfig.js';

import {importFrom} from '@davidkhala/light/es6.mjs';

const globalConfig = importFrom(import.meta, '../config/orgs.json');
export const setAnchorPeersByOrg = async (channelName, orgName, orderer, binPath) => {
	const orgConfig = globalConfig.channels[channelName].organizations[orgName];
	const {anchorPeerIndexes} = orgConfig;
	const user = helper.getOrgAdmin(orgName);

	const anchorPeers = anchorPeerIndexes.map(peerIndex => {
		const {container_name} = globalConfig.organizations[orgName].peers[peerIndex];
		return {host: container_name, port: 7051};
	});

	const channelConfig = new ChannelConfig(channelName, user, orderer, binPath);
	await channelConfig.setAnchorPeers(undefined, orgName, anchorPeers, true);


};
