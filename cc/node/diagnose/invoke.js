import {consoleLogger} from '@davidkhala/logger/log4.js';
import InvokeHelper from '../../../app/invokeHelper.js';
import * as helper from '../../../app/helper.js';
import {queryBuilder} from '../../../common/nodejs/couchdb.js';

const chaincodeId = 'nodeDiagnose';
const logger = consoleLogger(chaincodeId);
const {channelName} = process.env;
const clientOrg = 'icdd';
const peer = helper.newPeer(0, clientOrg);

const invokeHelper = new InvokeHelper(peer, clientOrg, chaincodeId, channelName);


describe('chaincode invoke', () => {
	it('put', async () => {

		await invokeHelper.invoke({args: ['put', 'a', '' + Date.now()]}, true);
		const result = await invokeHelper.query({
			args: ['getRaw', 'a']
		});
		console.debug(result);

	});
	it('putBatch', async () => {
		const size = 100;
		const object = {};
		for (let i = 0; i < size; i++) {
			object[i] = i;
		}

		await invokeHelper.invoke({
			args: ['putBatch', JSON.stringify(object)]
		});
	});

});
describe('chaincode common query', () => {

	it('timeStamp', async () => {

		const time = await invokeHelper.query({
			args: ['timeStamp']
		});
		logger.info({time});

	});
	it('whoami', async () => {
		const result = await invokeHelper.query({
			args: ['whoami']
		});
		console.debug(result);

	});
	it('chaincodeID', async () => {
		const result = await invokeHelper.query({
			args: ['chaincodeId']
		});
		console.debug(result[0]);
	});
	it('transient', async () => {
		const result = await invokeHelper.query({
			transientMap: {
				a: 'b'
			},
			args: ['transient', 'a']
		});
		console.debug(result);
	});
});

describe('chaincode rich query', async function () {
	this.timeout(0);
	it('loop to put', async () => {

		const size = 100;

		for (let i = 0; i < size; i++) {
			await invokeHelper.invoke({
				args: ['put', `${i}`, `${Date.now()}`]
			});
		}
	});
	it('rich query', async () => {
		const args = ['richQuery', queryBuilder(undefined, ['Time'], 0)];

		const queryResult = await invokeHelper.query({
			args
		});
		const cleanResult = JSON.parse(queryResult[0]);
		console.debug(cleanResult);
		console.debug(cleanResult.length);

	});
});
describe('chaincode stateful query', () => {
	it('history', async () => {
		const args = ['history', 'a'];

		const queryResult = await invokeHelper.query({
			args
		});
		console.debug(queryResult[0]);

	});
});