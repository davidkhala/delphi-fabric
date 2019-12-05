const peerUrl = 'https://localhost:9443';
const ordererUrl = 'https://localhost:8443';
const OperationService = require('../common/nodejs/operations');
const {LoggingLevel} = require('../common/nodejs/remote');
const logger = require('khala-logger/log4js').consoleLogger('test:operation');

const task = async () => {
	const helper = require('../app/helper');
	let peerResult;
	const peerKey = helper.projectResolve('config/ca-crypto-config/peerOrganizations/astri.org/client/clientKey');
	const peerCert = helper.projectResolve('config/ca-crypto-config/peerOrganizations/astri.org/client/clientCert');
	const peerHttpsOptions = {key: peerKey, cert: peerCert, json: true, rejectUnauthorized: false};
	const peerService = new OperationService(peerUrl, peerHttpsOptions);
	await peerService.setLogLevel(LoggingLevel.warning);
	peerResult = await peerService.getLogLevel();
	logger.info(peerUrl, peerResult);

	let ordererResult;
	const ordererKey = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/icdd.astri.org/client/clientKey');
	const ordererCert = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/icdd.astri.org/client/clientCert');
	const ordererHttpsOptions = {key: ordererKey, cert: ordererCert, json: true, rejectUnauthorized: false};
	const ordererService = new OperationService(ordererUrl, ordererHttpsOptions);
	ordererResult = await ordererService.getLogLevel();
	logger.info(ordererUrl, ordererResult);
	ordererResult = await ordererService.version();
	logger.info(ordererUrl, ordererResult);
};
task();
