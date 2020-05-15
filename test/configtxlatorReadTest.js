const helper = require('../app/helper');
const channelConfig = require('../common/nodejs/channelConfig');
const channelName = 'allchannel';
const fsExtra = require('fs-extra');
const logger = require('khala-logger/log4js').consoleLogger('test:configtxlator');
const orderers = helper.newOrderers();
const orderer = orderers[0];
const BinManager = require('../common/nodejs/binManager');
const appChannel = async () => {
	try {
		const user = helper.getOrgAdmin(undefined, 'peer');

		const {json} = await channelConfig.getChannelConfigReadable(channelName, user, orderer, process.env.viaServer);

		fsExtra.outputFileSync(`${channelName}${process.env.viaServer ? '-viaServer' : ''}.json`, json);
	} catch (e) {
		logger.error(e);
	}
};
const systemChannel = async () => {
	try {
		const user = helper.getOrgAdmin(undefined, 'orderer');
		const {json} = await channelConfig.getChannelConfigReadable(channelName, user, orderer, process.env.viaServer);

		fsExtra.outputFileSync(`testchainid${process.env.viaServer ? '-viaServer' : ''}.json`, json);
	} catch (e) {
		logger.error(e);
	}
};
const task = async () => {
	if (process.env.viaServer) {
		const path = require('path');
		const binPath = path.resolve(__dirname, '../common/bin/');
		const binManager = new BinManager(binPath);
		await binManager.configtxlatorRESTServer('start');
	}
	switch (parseInt(process.env.taskID)) {
		case 0: {
			// taskID=0 viaServer=true node test/configtxlatorReadTest.js

			await appChannel();
		}
			break;
		case 1: {
			// taskID=1 viaServer=true node test/configtxlatorReadTest.js
			await systemChannel();
		}
			break;
	}


};
task();



