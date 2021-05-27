const OperationService = require('../common/nodejs/operations');
const {TLS} = require('../config/orgs.json');
const logger = require('khala-logger/log4js').consoleLogger('test:operation');
describe('OperationService', () => {
	const httpsOptions = {rejectUnauthorized: false, json: true};
	it('peer health', async () => {
		const peerUrl = `http${TLS ? 's' : ''}://localhost:9443`;
		const service = new OperationService(peerUrl, httpsOptions);
		const isHealth = await service.health();
		logger.info(peerUrl, isHealth);
	});
	it('orderer health', async () => {
		const ordererUrl = `http${TLS ? 's' : ''}://localhost:8443`;
		const service = new OperationService(ordererUrl, httpsOptions);
		const isHealth = await service.health();
		logger.info(ordererUrl, isHealth);
	});
});
