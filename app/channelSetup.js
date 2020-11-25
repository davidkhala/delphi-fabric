const {joinAll, setAnchorPeersByOrg} = require('./channelHelper');
const ChannelUtil = require('../common/nodejs/channel');
const helper = require('./helper');
const {homeResolve, sleep} = require('khala-light-util');
const path = require('path');
const globalConfig = require('../config/orgs.json');
const BinManager = require('../common/nodejs/binManager');
const logger = require('khala-logger/log4js').consoleLogger('channel setup');
const CONFIGTX = homeResolve(globalConfig.docker.volumes.CONFIGTX);
const createTask = async (channelName) => {
	const channelsConfig = globalConfig.channels;
	const channelConfig = channelsConfig[channelName];
	const binManager = new BinManager();
	const channelBlock = path.resolve(CONFIGTX, channelConfig.file);
	const configtxFile = helper.projectResolve('config', 'configtx.yaml');
	await binManager.configtxgen(channelName, configtxFile, channelName).genBlock(channelBlock);
	const orderers = helper.newOrderers();

	// TODO WIP

};

describe('channelSetup', () => {
	const channelName = process.env.channelName ? process.env.channelName : 'allchannel';
	it('create', async function () {
		this.timeout(30000);
		process.env.binPath = path.resolve(__dirname, '../common/bin/');
		await createTask(channelName);
		await sleep(3000);
	});
	it('join', async function () {
		this.timeout(30000);
		const orderer = helper.newOrderers()[0];
		await orderer.connect();
		await joinAll(channelName, undefined, orderer);
	});
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





