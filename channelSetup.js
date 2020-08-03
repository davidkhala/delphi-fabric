/*
outputChannelJson has been moved to test/configtxlatorReadTest.js
 */
const ChannelHelper = require('./nodePkg/channelHelper');
const globalConfig = require('./config/orgs.json');
const channelHelper = new ChannelHelper(globalConfig);
const ChannelUtil = require('./common/nodejs/channel');
const Context = require('./nodePkg');
const context = new Context(globalConfig);
const path = require('path');
const BinManager = require('./common/nodejs/binManager');
const channelName = process.env.channelName ? process.env.channelName : 'allchannel';

describe('channel setup', () => {


	it('create', async () => {
		const channelsConfig = globalConfig.channels;
		const channelConfig = channelsConfig[channelName];
		const binManager = new BinManager();
		const channelFile = path.resolve(context.CONFIGTX_DIR, channelConfig.file);
		const configtxYaml = path.resolve(__dirname, 'config', 'configtx.yaml');
		await binManager.configtxgen(channelName, configtxYaml, channelName).genChannel(channelFile);
		const peerOrg = context.randomOrg('peer');
		const client = context.getOrgAdmin(peerOrg);
		const channel = context.prepareChannel(channelName, client);
		const orderers = context.newOrderers();
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
		const client = context.getOrgAdmin(undefined, 'orderer');

		const channel = context.prepareChannel(channelName, client);
		const orderer = context.newOrderers()[0];
		const block = await ChannelUtil.getGenesisBlock(channel, orderer);
		console.log(block);// TODO apply block decoder
	});
});





