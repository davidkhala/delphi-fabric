const {nodeUtil} = require('../../common/nodejs/helper');
const logger = nodeUtil.devLogger('test:peer HA');
const {sleep} = nodeUtil.helper();
const helper = require('../../app/helper');
const {installs} = require('../../app/installHelper');
const {join} = require('../../common/nodejs/channel');
const {resumePeer, stopPeer} = require('./');
const resumePeerChannel = async (orgName, peerIndex, channelName) => {
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeer(peerIndex, orgName);
	await join(channel, peer);

};

const touchCC = async (org, peerIndex) => {
	const {get} = require('../../cc/golang/master/masterInvoke');
	const peer = helper.newPeer(peerIndex, org);
	const counterKey = 'iterator';
	const result = await get([peer], org, counterKey);
	logger.debug(result);
};
const flowStopPeers = async () => {
	await stopPeer('icdd', 0);
	await stopPeer('icdd', 1);
	await stopPeer('ASTRI.org', 0);
	await stopPeer('ASTRI.org', 1);
};
const flowResumePeers = async () => {
	await resumePeer('icdd', 0);// anchor peers should resume first
	await resumePeer('ASTRI.org', 0);// anchor peers should resume first
};
const flow = async () => {
	const org = 'icdd';
	const peerIndex = 1;
	await stopPeer(org, peerIndex);
	await resumePeer(org, peerIndex);
	const channelName = 'allchannel';
	const chaincodeID = 'master';
	await resumePeerChannel(org, peerIndex, channelName, chaincodeID);
	await installs(chaincodeID, org, [peerIndex]);
	await sleep(30000);
	await touchCC(org, peerIndex);
};
const flow2 = async () => {
	await touchCC('icdd', 0);
	await flowStopPeers();
	await flowResumePeers();
	await touchCC('icdd', 0);
};
flow2();
