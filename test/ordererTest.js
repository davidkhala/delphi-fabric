const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:orderer');
const OrdererUtil = require('../common/nodejs/admin/orderer');

const task = async (taskID) => {

	switch (parseInt(taskID)) {
		case 0: {
			const host = 'localhost';
			const ordererHostName = 'orderer0.hyperledger';
			const ordererPort = 7050;
			const cert = helper.projectResolve('config/ca-crypto-config/ordererOrganizations/hyperledger/orderers/orderer0.hyperledger/tls/ca.crt');
			const ordererUtil_nonTLS = new OrdererUtil({ordererPort});
			await ordererUtil_nonTLS.connect();
			logger.info('nonTLS connected');
			ordererUtil_nonTLS.close();
			await ordererUtil_nonTLS.connect();
			logger.info('nonTLS reconnected');
			const ordererUtil = new OrdererUtil({host, ordererPort, ordererHostName, cert});
			logger.debug(ordererUtil.committer);
			await ordererUtil.connect();
		}
			break;
		case 2: {
			const orderers = await helper.newOrderers();
			const orderer = orderers[1];
			const ordererUtil = new OrdererUtil(undefined, orderer);
			await ordererUtil.connect();
			await ordererUtil.connect();
		}
			break;
		default: {
			const orderers = await helper.newOrderers();
			const orderer = orderers[1];
			const result = await OrdererUtil.ping(orderer);
			logger.debug(orderer.toString(), result);

		}
	}

};
task(process.env.taskID);



