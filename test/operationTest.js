const peerUrl = 'https://localhost:9443';
const ordererUrl = 'https://localhost:8443';
const operationUtil = require('../common/nodejs/operations');
const {LoggingLevel} = require('../common/nodejs/remote');
const logger = require('khala-logger/dev').devLogger('test:operation');

const task = async () => {
	let logLevel;
	const helper = require('../app/helper');
	const peerKey = helper.projectResolve('config/ca-crypto-config/peerOrganizations/astri.org/client/clientKey');
	const peerCert = helper.projectResolve('config/ca-crypto-config/peerOrganizations/astri.org/client/clientCert');
	const peerHttpsOptions = {key: peerKey, cert: peerCert, json: true, rejectUnauthorized: false};
	await operationUtil.setLogLevel(peerUrl, LoggingLevel.warning, peerHttpsOptions);
	logLevel = await operationUtil.getLogLevel(peerUrl, peerHttpsOptions);
	console.log(peerUrl, logLevel);

	const ordererKey = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/icdd.astri.org/client/clientKey');
	const ordererCert = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/icdd.astri.org/client/clientCert');
	const ordererHttpsOptions = {key: ordererKey, cert: ordererCert, json: true, rejectUnauthorized: false};
	logLevel = await operationUtil.getLogLevel(ordererUrl, ordererHttpsOptions);
	console.log(ordererUrl, logLevel);
};
task();
