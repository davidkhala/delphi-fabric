/*
outputChannelJson has been moved to test/configtxlatorReadTest.js
 */
const {create, joinAll, setupAnchorPeersFromFile, setAnchorPeersByOrg} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const helper = require('./helper');
const {sleep, homeResolve} = require('khala-nodeutils/helper');
const path = require('path');

const globalConfig = require('../config/orgs.json');


const anchorPeerTask = async (channelName, channelConfig, byFile) => {
	for (const org in channelConfig.orgs) {
		if (byFile) {
			await setupAnchorPeersFromFile(path.resolve(__dirname, '../config/configtx.yaml'), channelName, org);
		} else {
			await setAnchorPeersByOrg(channelName, org);
		}
		await sleep(1000);// TODO not to use block waiter, validate config fetch from orderer
	}
};
const taskViewChannelBlock = async (channelName) => {
	const client = helper.getOrgAdmin(undefined, 'peer');
	const channel = helper.prepareChannel(channelName, client);
	const orderer = ChannelUtil.getOrderers(channel, false)[0];
	const block = await ChannelUtil.getGenesisBlock(channel, orderer);
	console.log(block);
};


const e2eTask = async (channelName) => {
	const peerOrg = helper.randomOrg('peer');
	const client = helper.getOrgAdmin(peerOrg);
	const channel = helper.prepareChannel(channelName, client);
	const orderers = await ChannelUtil.getOrderers(channel, true);
	const orderer = orderers[0];

	const channelConfig = globalConfig.channels[channelName];
	const channelConfigFile = homeResolve(globalConfig.docker.volumes.CONFIGTX, channelConfig.file);
	await create(channel, channelConfigFile, orderer);

	await joinAll(channelName);

	await sleep(1000);
	await anchorPeerTask(channelName, channelConfig);
};
const task = async (taskID = parseInt(process.env.taskID)) => {

	const channelName = process.env.channelName ? process.env.channelName : 'allchannel';
	switch (taskID) {
		case 1:
			await e2eTask(channelName);
			break;
		case 2:
			await taskViewChannelBlock(channelName);
			break;
		default:
	}

};


task();





