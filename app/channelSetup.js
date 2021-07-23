const {joinAll, setAnchorPeersByOrg} = require('./channelHelper');

const helper = require('./helper');
const path = require('path');
const globalConfig = require('../config/orgs.json');
const BinManager = require('../common/nodejs/binManager');
const {homeResolve} = require('khala-light-util');

const channelsConfig = globalConfig.channels;

describe('channelSetup', () => {
	const channelName = process.env.channelName || 'allchannel';
	it('create', async function () {
		this.timeout(0);
		const channelConfig = channelsConfig[channelName];
		const channelBlock = homeResolve(channelConfig.file);
		const binManager = new BinManager();

		const configtxFile = helper.projectResolve('config', 'configtx.yaml');
		await binManager.configtxgen(channelName, configtxFile, channelName).genBlock(channelBlock);
	});
	it('join', async function () {
		this.timeout(0);
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







