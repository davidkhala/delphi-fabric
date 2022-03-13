import {consoleLogger} from '@davidkhala/logger/log4.js';
import {sleep} from '@davidkhala/light/index.js';
import * as helper from '../../app/helper.js';
import {installs} from '../../app/installHelper.js';
import {join} from '../../common/nodejs/channel.js';
import {resumePeer, stopPeer} from './index.js';

const logger = consoleLogger('test:peer HA');

const resumePeerChannel = async (orgName, peerIndex, channelName) => {
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeer(peerIndex, orgName);
	await join(channel, peer);

};

const touchCC = async (org, peerIndex) => {

	const peer = helper.newPeer(peerIndex, org);
	const counterKey = 'iterator';
	const result = await get([peer], org, counterKey);
	logger.debug(result);
};
const stopPeers = async () => {
	await stopPeer('icdd', 0);
	await stopPeer('icdd', 1);
	await stopPeer('astri.org', 0);
	await stopPeer('astri.org', 1);
};
const resumePeers = async () => {
	// resume: anchor peers should resume first
	await resumePeer('icdd', 0);
	await resumePeer('astri.org', 0);
};
describe('flow', () => {

	it('1', async () => {
		await stopPeers();
		await resumePeers();
		const org = 'icdd';
		const peerIndex = 1;
		const channelName = 'allchannel';
		const chaincodeID = 'master';
		await resumePeerChannel(org, peerIndex, channelName, chaincodeID);
		await installs(chaincodeID, org, [peerIndex]);
		await sleep(30000);
		await touchCC(org, peerIndex);
	});
	it('2', async () => {
		await touchCC('icdd', 0);
		await stopPeers();
		await resumePeers();
		await touchCC('icdd', 0);
	});
});
