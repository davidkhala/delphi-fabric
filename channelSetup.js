/*
outputChannelJson has been moved to test/configtxlatorReadTest.js
 */
const ChannelHelper = require('./nodePkg/channelHelper');
const globalConfig = require('./config/orgs.json');
const channelHelper = new ChannelHelper(globalConfig);
const ChannelUtil = require('./common/nodejs/channel');
const Context = require('./nodePkg');
const helper = new Context(globalConfig);
const {homeResolve} = require('khala-nodeutils/helper');
const path = require('path');
const BinManager = require('./common/nodejs/binManager');
const channelName = process.env.channelName ? process.env.channelName : 'allchannel';

const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);


describe('channel setup', () => {


	it('create', async () => {
		const channelsConfig = globalConfig.channels;
		const channelConfig = channelsConfig[channelName];
		const binManager = new BinManager();
		const channelFile = path.resolve(CONFIGTX, channelConfig.file);
		const configtxFile = Context.projectResolve('config', 'configtx.yaml');
		await binManager.configtxgen(channelName, configtxFile, channelName).genChannel(channelFile);
		const peerOrg = helper.randomOrg('peer');
		const client = helper.getOrgAdmin(peerOrg);
		const channel = helper.prepareChannel(channelName, client);
		const orderers = helper.newOrderers();
		const orderer = orderers[0];

		await channelHelper.create(channel, channelFile, orderer, undefined, process.env.useSignconfigtx);

	});
	it('join all', async () => {
		await channelHelper.joinAll(channelName);
	});
	it('configure anchor peer', async () => {
		const channelConfig = globalConfig.channels[channelName];
		for (const org in channelConfig.organizations) {
			await channelHelper.setAnchorPeersByOrg(channelName, org);
		}
	});
});
describe('view channel', () => {
	it('view channel block', async () => {
		const client = helper.getOrgAdmin(undefined, 'orderer');

		const channel = helper.prepareChannel(channelName, client);
		const orderer = helper.newOrderers()[0];
		const block = await ChannelUtil.getGenesisBlock(channel, orderer);
		console.log(block);// TODO apply block decoder
	});
});





