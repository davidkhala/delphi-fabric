const {invoke, query} = require('../../../app/invokeHelper');
const helper = require('../../../app/helper');
const chaincodeId = 'nodeDiagnose';
const logger = require('khala-logger/log4js').consoleLogger(chaincodeId);
describe('chaincode Initialize', () => {

	const peers = helper.allPeers();
	it('init', async () => {
		const org = 'icdd';
		try {
			await invoke(peers, org, chaincodeId, {
				init: true,
			});
		} catch (e) {
			logger.error(e.errors);
		}

	});
});

