import InvokeHelper from '../../../app/invokeHelper.js';
import * as helper from '../../../app/helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {queryBuilder} from '../../../common/nodejs/couchdb.js';

const chaincodeId = 'nodeDiagnose';
const logger = consoleLogger(chaincodeId);
const {channelName} = process.env;
const clientOrg = 'icdd';
const peer = helper.newPeer(0, clientOrg);

const invoke = new InvokeHelper(peer, clientOrg, chaincodeId, channelName).invoke;
const query = new InvokeHelper(peer, clientOrg, chaincodeId, channelName).query;

describe('chaincode Initialize', () => {

	it('init', async () => {
		await invoke({args: ['init']}, true);
	});
});
describe('chaincode invoke', () => {
	it('put', async () => {


		await invoke({args: ['put', 'a', '' + Date.now()]}, true);
		const result = await query({
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

		await invoke({
			args: ['putBatch', JSON.stringify(object)]
		});
	});

});
describe('chaincode common query', () => {

	it('timeStamp', async () => {

		const time = await query({
			args: ['timeStamp']
		});
		logger.info({time});

	});
	it('whoami', async () => {
		const result = await query({
			args: ['whoami']
		});
		console.debug(result);

	});
	it('chaincodeID', async () => {
		const result = await query({
			args: ['chaincodeId']
		});
		console.debug(result[0]);
	});
	it('transient', async () => {
		const result = await query({
			transientMap: {
				a: 'b'
			},
			args: ['transient', 'a']
		});
		console.debug(result);
	});
});

describe('chaincode rich query', async () => {

	it('loop to put', async function () {

		const size = 100;
		this.timeout(0);
		for (let i = 0; i < size; i++) {
			await invoke({
				args: ['put', `${i}`, `${Date.now()}`]
			});
		}
	});
	it('rich query', async () => {
		const args = ['richQuery', queryBuilder(undefined, ['Time'], 0)];

		const queryResult = await query(chaincodeId, {
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

		const queryResult = await query({
			args
		});
		console.debug(queryResult[0]);

	});
});