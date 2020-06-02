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

	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	await orderer.connect();
	for (const org in channelConfig.organizations) {
		await setAnchorPeersByOrg(channelName, org, orderer, process.env.viaServer);
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
	await orderer.connect();
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

	await orderer.connect();
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

describe('channelSetup', () => {
	const channelName = process.env.channelName ? process.env.channelName : 'allchannel';
	it('create', async () => {
		process.env.binPath = path.resolve(__dirname, '../common/bin/');
		await createTask(channelName);
	});
	it('join', async function () {
		this.timeout(30000);
		const orderer = helper.newOrderers()[0];
		await orderer.connect();
		await joinAll(channelName, undefined, orderer);
	});
	it('setup anchor peer', async () => {
		process.env.binPath = path.resolve(__dirname, '../common/bin/');
		await anchorPeerTask(channelName);
	});
	it('view current channel config', async () => {
		await taskViewChannelBlock(channelName);
	});
	it('view genesis block', async () => {
		await taskViewGenesisBlock(channelName);
	});

});





