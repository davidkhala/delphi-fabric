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
	const org = 'icdd';
	const peers = helper.newPeers([0], org);
	it('timeStamp', async () => {

		const time = await query(peers, org, chaincodeId, {
			fcn: 'timeStamp'
		});
		logger.info({time});

	});
	it('put', async () => {
		const peers = helper.allPeers();

		await invoke(peers, org, chaincodeId, {
			fcn: 'put', args: ['a', 'b']
		});
		const result = await query(peers, org, chaincodeId, {
			fcn: 'getRaw', args: ['a']
		});
		console.debug(result);

	});
	it('transient', async () => {
		const result = await query(peers, org, chaincodeId, {
			fcn: 'transient', transientMap: {
				a: 'b'
			},
			args: ['a']
		});
		console.debug(result);


	});
	it('whoami', async () => {
		const result = await query(peers, org, chaincodeId, {
			fcn: 'whoami'
		});
		console.debug(result);

	});
	it('chaincodeID', async () => {
		const result = await query(peers, org, chaincodeId, {
			fcn: 'chaincodeId'
		});
		console.debug(result[0]);
	});
});

