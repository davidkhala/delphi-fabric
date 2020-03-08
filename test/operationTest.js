const peerUrl = 'https://localhost:9443';
const ordererUrl = 'https://localhost:8443';
const OperationService = require('../common/nodejs/operations');
const {LoggingLevel} = require('../common/nodejs/formatter/remote');
const logger = require('khala-logger/log4js').consoleLogger('test:operation');
const helper = require('../app/helper');

const task = async () => {
	const {taskID, action} = process.env;
	switch (parseInt(taskID)) {
		case 0: {
			// taskID=0 node test/operationTest.js
			const peerKey = helper.projectResolve('config/ca-crypto-config/peerOrganizations/astri.org/client/clientKey');
			const peerCert = helper.projectResolve('config/ca-crypto-config/peerOrganizations/astri.org/client/clientCert');
			const peerHttpsOptions = {key: peerKey, cert: peerCert, json: true, rejectUnauthorized: false};
			const peerService = new OperationService(peerUrl, peerHttpsOptions);
			switch (action) {
				case 'set':
					await peerService.setLogLevel(LoggingLevel.warning);
					break;
				default:
			}
			await peerService.health();
			const logLevel = await peerService.getLogLevel();
			const version = await peerService.version();
			logger.info(peerUrl, {logLevel, version});
		}
			break;

		case 1: {
			let ordererResult;
			const ordererKey = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/hyperledger/client/clientKey');
			const ordererCert = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/hyperledger/client/clientCert');
			const ordererHttpsOptions = {key: ordererKey, cert: ordererCert, json: true, rejectUnauthorized: false};
			const ordererService = new OperationService(ordererUrl, ordererHttpsOptions);
			ordererResult = await ordererService.getLogLevel();
			logger.info(ordererUrl, ordererResult);
			ordererResult = await ordererService.version();
			logger.info(ordererUrl, ordererResult);

		}
			break;
	}

};
task();
