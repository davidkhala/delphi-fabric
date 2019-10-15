/*
outputChannelJson has been moved to test/configtxlatorReadTest.js
 */
const {create, joinAll, setupAnchorPeersFromFile, setAnchorPeersByOrg} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const helper = require('./helper');
const {sleep, homeResolve, fsExtra} = require('../common/nodejs');
const path = require('path');
const channelName = 'allchannel';

const globalConfig = require('../config/orgs.json');
const channelConfig = globalConfig.channels[channelName];
const channelConfigFile = homeResolve(globalConfig.docker.volumes.CONFIGTX, channelConfig.file);

const createTask = async (channel, orderer) => {
	await create(channel, channelConfigFile, orderer);
};
const joinTask = async () => {
	await joinAll(channelName);
};

const anchorPeerTask = async (byFile) => {
	for (const org in channelConfig.orgs) {
		if (byFile) {
			await setupAnchorPeersFromFile(path.resolve(__dirname, '../config/configtx.yaml'), channelName, org);
		} else {
			await setAnchorPeersByOrg(channelName, org);
		}
		await sleep(1000);// TODO not to use block waiter, validate config fetch from orderer
	}
};
const taskViewChannelBlock = async () => {
	await task();
	const client = await helper.getOrgAdmin(undefined, 'peer');
	const channel = helper.prepareChannel(channelName, client);
	const orderer = ChannelUtil.getOrderers(channel, false)[0];
	const block = await ChannelUtil.getGenesisBlock(channel, orderer);
	console.log(block);
};
const task = async () => {
	const peerOrg = helper.randomOrg('peer');
	const client = await helper.getOrgAdmin(peerOrg);
	const channel = helper.prepareChannel(channelName, client);
	const orderers = await ChannelUtil.getOrderers(channel, true);
	const orderer = orderers[0];
	await createTask(channel, orderer);
	await joinTask();

	await sleep(1000);
	await anchorPeerTask();
};


task();





