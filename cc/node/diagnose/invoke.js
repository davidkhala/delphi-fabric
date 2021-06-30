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
	const peers = helper.allPeers();
	it('put', async () => {


		await invoke(peers, org, chaincodeId, {
			fcn: 'put', args: ['a', '' + Date.now()]
		});
		const result = await query(peers, org, chaincodeId, {
			fcn: 'getRaw', args: ['a']
		});
		console.debug(result);

	});
	it('putBatch', async () => {
		const size = 100;
		const object = {};
		for (let i = 0; i < size; i++) {
			object[i] = i;
		}

		await invoke(peers, org, chaincodeId, {
			fcn: 'putBatch', args: [JSON.stringify(object)]
		});
	});

});
describe('chaincode common query', () => {
	const org = 'icdd';
	const peers = helper.newPeers([0], org);
	it('timeStamp', async () => {

		const time = await query(peers, org, chaincodeId, {
			fcn: 'timeStamp'
		});
		logger.info({time});

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
	it('transient', async () => {
		const result = await query(peers, org, chaincodeId, {
			fcn: 'transient', transientMap: {
				a: 'b'
			},
			args: ['a']
		});
		console.debug(result);
	});
});
const {queryBuilder} = require('../../../common/nodejs/couchdb');
describe('chaincode rich query', async () => {
	const org = 'astri.org';
	const peers = helper.newPeers([0], org);

	it('loop to put', async function () {
		const peers = helper.allPeers();
		const size = 100;
		this.timeout(size * 3000);
		for (let i = 0; i < size; i++) {
			await invoke(peers, org, chaincodeId, {
				fcn: 'put', args: [`${i}`, `${Date.now()}`]
			});
		}
	});
	it('rich query', async () => {
		const fcn = 'richQuery';
		const args = [queryBuilder(undefined, ['Time'], 0)];

		const queryResult = await query(peers, org, chaincodeId, {
			fcn, args
		});
		const cleanResult = JSON.parse(queryResult[0]);
		console.debug(cleanResult);
		console.debug(cleanResult.length);

	});
});
describe('chaincode stateful query', () => {
	const org = 'astri.org';
	const peers = helper.newPeers([0], org);
	it('history', async () => {
		const fcn = 'history';
		const args = ['a'];

		const queryResult = await query(peers, org, chaincodeId, {
			fcn, args
		});
		console.debug(queryResult[0]);

	});
});