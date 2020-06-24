const OperationService = require('../common/nodejs/operations');
const logger = require('khala-logger/log4js').consoleLogger('test:operation');
describe('OperationService', () => {
	const httpsOptions = {rejectUnauthorized: false, json: true};
	it('peer health', async () => {
		const peerUrl = 'https://localhost:9443';
		const service = new OperationService(peerUrl, httpsOptions);
		const isHealth = await service.health();
		logger.info(peerUrl, isHealth);
	});
	it('orderer health', async () => {
		const ordererUrl = 'https://localhost:8443';
		const service = new OperationService(ordererUrl, httpsOptions);
		const isHealth = await service.health();
		logger.info(ordererUrl, isHealth);
	});
});
