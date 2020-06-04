const helper = require('../app/helper');
const channelConfig = require('../common/nodejs/channelConfig');
const channelName = 'allchannel';
const fsExtra = require('fs-extra');
const logger = require('khala-logger/log4js').consoleLogger('test:configtxlator');
const orderers = helper.newOrderers();
const orderer = orderers[0];
const BinManager = require('../common/nodejs/binManager');
const path = require('path');
process.env.binPath = path.resolve(__dirname, '../common/bin/');
describe('configtxlator', async () => {
	let viaServer;

	it('viaServer', async () => {
		const binPath = path.resolve(__dirname, '../common/bin/');
		const binManager = new BinManager(binPath);
		await binManager.configtxlatorRESTServer('start');
		viaServer = true;
	});

	before(async () => {
		await orderer.connect();
	});
	describe('app channel', () => {

		const user = helper.getOrgAdmin(undefined, 'peer');

		it('read', async () => {
			const {json} = await channelConfig.getChannelConfigReadable(channelName, user, orderer, viaServer);
			logger.info(JSON.parse(json));
		});

	});
	describe('systemChannel', () => {
		const user = helper.getOrgAdmin(undefined, 'orderer');
		it('read', async () => {
			const {json} = await channelConfig.getChannelConfigReadable(channelName, user, orderer, viaServer);
			logger.info(JSON.parse(json));
		});
	});
});




