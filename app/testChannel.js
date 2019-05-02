const {create, joinAll, updateAnchorPeers} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const helper = require('./helper');
const {sleep, homeResolve, fsExtra} = require('../common/nodejs/helper').nodeUtil.helper();
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
const anchorPeerTask = async () => {
	for (const org in channelConfig.orgs) {
		await updateAnchorPeers(path.resolve(__dirname, '../config/configtx.yaml'), channelName, org);
		await sleep(1000);// TODO wait block to broadcast
	}
};
const outputChannelJson = async (peer) => {
	const configtxlator = require('../common/nodejs/configtxlator');
	const client = await helper.getOrgAdmin(peer ? peer.peerConfig.orgName : undefined, peer ? 'peer' : 'orderer');

	const channel = helper.prepareChannel(peer ? channelName : undefined, client);
	const {original_config} = await configtxlator.getChannelConfigReadable(channel, peer);

	fsExtra.outputFileSync(`${channel.getName()}.json`, original_config);
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





