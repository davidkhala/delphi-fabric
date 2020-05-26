const helper = require('../../../../app/helper');
const {invoke} = require('../../../../app/invokeHelper');
const {putRaw, getRaw} = require('../diagnoseInvoke');
const chaincodeId = 'diagnose';
const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');
describe('chaincode Initialize', () => {

	it('init', async () => {
		const peers = helper.allPeers();
		const org = 'icdd';
		await invoke(peers, org, chaincodeId, {
			init: true,
		});
	});
	it('put & get raw value', async () => {
		const peers = helper.allPeers();
		const org = 'icdd';
		const value = Date.now().toString();
		const key = 'a';
		await putRaw(peers, org, key, value);
		const queryResult = await getRaw(peers, org, key);
		logger.info(queryResult);
	});
});