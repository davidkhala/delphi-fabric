/*
outputChannelJson has been moved to test/configtxlatorReadTest.js
 */
const {create, joinAll, setAnchorPeersByOrg} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const {genesis} = require('../common/nodejs/formatter/channel');
const helper = require('./helper');
const {homeResolve} = require('khala-nodeutils/helper');

const globalConfig = require('../config/orgs.json');
const BinManager = require('../common/nodejs/binManager');

const anchorPeerTask = async (channelName) => {
	const channelConfig = globalConfig.channels[channelName];
	for (const org in channelConfig.orgs) {
		await setAnchorPeersByOrg(channelName, org);
	}
};
const taskViewChannelBlock = async (channelName) => {
	let client;
	if (channelName === genesis) {
		client = helper.getOrgAdmin(undefined, 'orderer');
	} else {
		client = helper.getOrgAdmin(undefined, 'peer');
	}
	const channel = helper.prepareChannel(channelName, client);
	const orderer = helper.newOrderers()[0];
	const block = await ChannelUtil.getGenesisBlock(channel, orderer);
	console.log(block);// TODO apply block decoder
};
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const createTask = async (channelName) => {
	const channelsConfig = globalConfig.channels;
	const channelConfig = channelsConfig[channelName];
	const binManager = new BinManager();
	const channelFile = path.resolve(CONFIGTX, channelConfig.file);
	await binManager.configtxgen(channelName, configtxFile, channelName).genChannel(channelFile);
	const peerOrg = helper.randomOrg('peer');
	const client = helper.getOrgAdmin(peerOrg);
	const channel = helper.prepareChannel(channelName, client);
	const orderers = helper.newOrderers();
	const orderer = orderers[0];

	await create(channel, channelFile, orderer);
};

const task = async (taskID = parseInt(process.env.taskID)) => {

	const channelName = process.env.channelName ? process.env.channelName : 'allchannel';
	switch (taskID) {
		case 0:
			await createTask(channelName);
			break;
		case 1:
			// taskID=1 channelName=allchannel node app/channelSetup.js
			// taskID=1 channelName=testchainid node app/channelSetup.js
			await joinAll(channelName);
			break;
		case 2:
			await anchorPeerTask(channelName);
			break;
		case 3:
			// export binPath=$PWD/common/bin/
			// taskID=3 channelName=testchainid node app/channelSetup.js
			await taskViewChannelBlock(channelName);
			break;
		default:
			await createTask(channelName);
			await joinAll(channelName);
			await anchorPeerTask(channelName);
	}

};


task();





