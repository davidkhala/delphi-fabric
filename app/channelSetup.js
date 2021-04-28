const {joinAll, setAnchorPeersByOrg} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const helper = require('./helper');
const path = require('path');
const globalConfig = require('../config/orgs.json');
const BinManager = require('../common/nodejs/binManager');
const {homeResolve} = require('khala-light-util');
const logger = require('khala-logger/log4js').consoleLogger('channel setup');
const channelsConfig = globalConfig.channels;
const createTask = async (channelName) => {

	const channelConfig = channelsConfig[channelName];
	const channelBlock = homeResolve(channelConfig.file);
	const binManager = new BinManager();

	const configtxFile = helper.projectResolve('config', 'configtx.yaml');
	await binManager.configtxgen(channelName, configtxFile, channelName).genBlock(channelBlock);

};

describe('channelSetup', () => {
	const channelName = process.env.channelName ? process.env.channelName : 'allchannel';
	it('create', async function () {
		this.timeout(30000);
		await createTask(channelName);
	});
	it('join', async function () {
		this.timeout(30000);
		await joinAll(channelName);
	});
	if (process.env.anchor) {
		it('setup anchor peer', async () => {

			process.env.binPath = path.resolve(__dirname, '../common/bin/');
			const channelConfig = globalConfig.channels[channelName];

			const orderers = helper.newOrderers();
			const orderer = orderers[0];
			await orderer.connect();
			for (const org in channelConfig.organizations) {
				await setAnchorPeersByOrg(channelName, org, orderer, process.env.viaServer);
			}
		});
	}
});

describe('channel view', () => {
	it('view current channel config', async () => {
		const user = helper.getOrgAdmin(undefined, 'orderer');
		const channel = helper.prepareChannel(channelName);
		const orderer = helper.newOrderers()[0];

		await orderer.connect();
		const configBlock = await ChannelUtil.getChannelConfigFromOrderer(channel.name, user, orderer);
		logger.debug('configBlock', configBlock);
	});
	it('view genesis block', async () => {
		const user = helper.getOrgAdmin(undefined, 'orderer');
		const channel = helper.prepareChannel(channelName);
		const orderer = helper.newOrderers()[0];
		await orderer.connect();
		const genesisBlock = await ChannelUtil.getGenesisBlock(channel, user, orderer);
		return genesisBlock;
	});
});





