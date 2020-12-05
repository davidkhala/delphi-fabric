const {invoke, query} = require('../../../app/invokeHelper');
const helper = require('../../../app/helper');
const chaincodeId = 'nodeDiagnose';
const logger = require('khala-logger/log4js').consoleLogger(chaincodeId);
describe('chaincode Initialize', () => {

	const peers = helper.allPeers();
	it('init', async () => {
		const org = 'icdd';
		await invoke(peers, org, chaincodeId, {
			init: true,
		});

	});
});
describe('chaincode invoke', () => {
	it('timeStamp', async () => {
		const org = 'icdd';
		const peers = helper.newPeers([0], org);
		try {
			const time = await query(peers, org, chaincodeId, {
				fcn: 'timeStamp'
			});
			logger.info({time});
		} catch (e) {
			logger.error(e.errors);
		}

	});
});

