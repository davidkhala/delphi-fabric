const {create, joinAll, setAnchorPeersByOrg} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const {genesis} = require('../common/nodejs/formatter/channel');
const helper = require('./helper');
const {homeResolve} = require('khala-light-util');
const path = require('path');
const globalConfig = require('../config/orgs.json');
const BinManager = require('../common/nodejs/binManager');

const anchorPeerTask = async (channelName) => {
	const channelConfig = globalConfig.channels[channelName];

	for (const org in channelConfig.organizations) {
		await setAnchorPeersByOrg(channelName, org, process.env.viaServer);
	}
};
const taskViewGenesisBlock = async (channelName) => {
	let user;
	if (channelName === genesis) {
		user = helper.getOrgAdmin(undefined, 'orderer');
	} else {
		user = helper.getOrgAdmin(undefined, 'peer');
	}
	const channel = helper.prepareChannel(channelName);
	const orderer = helper.newOrderers()[0];
	const genesisBlock = await ChannelUtil.getGenesisBlock(channel, user, orderer);

	return genesisBlock;

};
const taskViewChannelBlock = async (channelName) => {
	let user;
	if (channelName === genesis) {
		user = helper.getOrgAdmin(undefined, 'orderer');
	} else {
		user = helper.getOrgAdmin(undefined, 'peer');
	}
	const channel = helper.prepareChannel(channelName);
	const orderer = helper.newOrderers()[0];

	const configBlock = await ChannelUtil.getChannelConfigFromOrderer(channel.name, user, orderer);
	console.debug('configBlock', configBlock);

};
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const createTask = async (channelName) => {
	const channelsConfig = globalConfig.channels;
	const channelConfig = channelsConfig[channelName];
	const binManager = new BinManager();
	const channelFile = path.resolve(CONFIGTX, channelConfig.file);
	const configtxFile = helper.projectResolve('config', 'configtx.yaml');
	await binManager.configtxgen(channelName, configtxFile, channelName).genChannel(channelFile);
	const orderers = helper.newOrderers();
	const orderer = orderers[0];

	await create(channelName, orderer, undefined, process.env.useSignconfigtx);
};

const task = async () => {

	const channelName = process.env.channelName ? process.env.channelName : 'allchannel';
	switch (parseInt(process.env.taskID)) {
		case 0:
			await createTask(channelName);
			break;
		case 1: {
			// taskID=1 channelName=allchannel node app/channelSetup.js
			const orderer = helper.newOrderers()[0];
			await joinAll(channelName, undefined, orderer);
		}
			break;
		case 2:
			await anchorPeerTask(channelName);
			break;
		case 3:
			// export binPath=$PWD/common/bin/
			// taskID=3 channelName=testchainid node app/channelSetup.js
			await taskViewChannelBlock(channelName);
			break;
		default: {
			await createTask(channelName);
			const orderer = helper.newOrderers()[0];
			await joinAll(channelName, undefined, orderer);
			await anchorPeerTask(channelName);
		}
	}

};


task().catch(err => {
	console.error(err);
	process.exit(1);
});





