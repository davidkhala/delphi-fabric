import assert from 'assert';
import * as helper from '../../app/helper.js';
import FabricGateway from '../../common/nodejs/fabric-gateway/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../../common/nodejs/admin/user.js';
import {dev, installAndApprove, commit, getContract} from '../testutil.js';

const chaincodeID = 'contracts';
const logger = consoleLogger(`chaincode:${chaincodeID}`);
const orderers = helper.newOrderers();
const orderer = orderers[0];
const channel = 'allchannel';

describe('deploy', function () {
	this.timeout(0);

	it('dev', async () => {
		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await dev(org, chaincodeID);
		}
	});
	it('install & approve', async () => {
		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await installAndApprove(org, chaincodeID, orderer);
		}

	});
	it('commit', async () => {
		const org = 'icdd';
		await commit(org, chaincodeID, orderer);
	});
});
describe('invoke', function () {
	this.timeout(0);
	const contract = getContract(chaincodeID);

	it('touch', async () => {
		contract.subContract = 'StupidContract';
		await contract.evaluateTransaction('ping');
		// touch submit
		await contract.submitTransaction('ping');
		delete contract.subContract;
	});
	it('who', async () => {
		contract.subContract = 'SmartContract';
		const result = await contract.evaluateTransaction('who');
		logger.info(result);
		delete contract.subContract;
	});
	it('error', async () => {
		await assert.rejects(async () => {
			await contract.evaluateTransaction('StupidContract:error');
		});
	});
	it('UnUsedContext', async () => {
		const r = await contract.evaluateTransaction('StupidContract:UnUsedContext');
		assert.ok(!r);
	});
	it('OnlyParams', async () => {
		await assert.rejects(contract.evaluateTransaction('StupidContract:OnlyParams'));
		await assert.rejects(contract.evaluateTransaction('StupidContract:OnlyParams', 'git', 'hub'));
	});
	it('StringParam', async () => {
		const p1 = 'git';
		assert.deepEqual(await contract.evaluateTransaction('StupidContract:StringParam', p1), p1);
	});
	it('StringParams', async () => {

		await assert.rejects(contract.evaluateTransaction('StupidContract:StringParams', ['a', 'b']));
		await assert.rejects(contract.evaluateTransaction('StupidContract:StringParams', 'a', 'b'));
	});
	it('standard', async () => {
		await assert.rejects(contract.evaluateTransaction('standard'));
		assert.equal(await contract.evaluateTransaction('standard', 'a'), 'a');
		const result = await contract.evaluateTransaction('now');
		const chaincodeTime = new Date(result);
		assert.ok(chaincodeTime < new Date());

	});
	it('defer', async () => {

		try {
			await contract.evaluateTransaction('StupidContract:defer');
		} catch (e) {
			const {code, details} = e;
			assert.equal(code, 2);
			assert.equal(details[0].message, 'chaincode response 500, defer');
		}

	});
	it('stress 10', async () => {
		contract.subContract = 'StupidContract';
		for (let i = 0; i < 10; i++) {
			await contract.submitTransaction('ping');
		}
		for (let i = 0; i < 10; i++) {
			await contract.submit(['ping'], undefined, undefined, true);
		}
		for (let i = 0; i < 10; i++) {
			await contract.evaluateTransaction('ping');
		}
		delete contract.subContract;
	});
});



