const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:orderer');
const OrdererUtil = require('../common/nodejs/admin/orderer');

describe('orderer', async () => {

	it('nonTLS connect for TLS enabled orderer', async () => {
		const host = 'localhost';
		const ordererHostName = 'orderer0.hyperledger';
		const ordererPort = 7050;
		const tlsCaCert = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/hyperledger/orderers/orderer0.hyperledger/tls/ca.crt');
		const ordererUtil_nonTLS = new OrdererUtil({ordererPort});
		await ordererUtil_nonTLS.connect();
		logger.info('nonTLS connected');
		ordererUtil_nonTLS.disconnect();
		await ordererUtil_nonTLS.connect();
		logger.info('nonTLS reconnected');
		const ordererUtil = new OrdererUtil({host, ordererPort, ordererHostName, tlsCaCert});
		logger.debug(ordererUtil.committer);
		await ordererUtil.connect();
	});
	it('duplicated connect', async () => {
		const orderers = await helper.newOrderers();
		const orderer = orderers[0];
		const ordererUtil = new OrdererUtil(undefined, orderer.committer, logger);
		await ordererUtil.connect();
		await ordererUtil.connect();
	});
	it('ping', async () => {
		const orderers = await helper.newOrderers();
		const orderer = orderers[0];
		const result = await orderer.ping(orderer);
		logger.debug(orderer.toString(), result);
	});
});




