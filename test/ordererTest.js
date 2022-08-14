import * as  helper from '../app/helper.js';
import OrdererUtil from '../common/nodejs/admin/orderer.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {importFrom} from '@davidkhala/light/es6.mjs';

const globalConfig = importFrom('../config/orgs.json', import.meta);
const logger = consoleLogger('test:orderer');
describe('orderer', async () => {

	if (globalConfig.TLS) {
		it('nonTLS connect for TLS enabled orderer', async function () {
			this.timeout(0);
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
	}

	it('duplicated connect', async () => {
		const orderers = await helper.newOrderers();
		const orderer = orderers[0];
		const ordererUtil = new OrdererUtil(undefined, orderer.committer, logger);
		await ordererUtil.connect();
		await ordererUtil.connect();
	});
	it('ping', async () => {
		const orderers = await helper.newOrderers();
		for(const orderer of orderers){
			const result = await orderer.ping();
			logger.info(orderer.toString(), result);
		}

	});
});




