import assert from 'assert';
import * as helper from '../../app/helper.js';
import {installAll} from '../../app/installHelper.js';
import FabricGateway from '../../common/nodejs/fabric-gateway/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../../common/nodejs/admin/user.js';
import {dev, smartApprove, commit} from '../testutil.js';

const chaincodeID = 'contracts';
const logger = consoleLogger(`chaincode:${chaincodeID}`);
const orderers = helper.newOrderers();
const orderer = orderers[0];
const channel = 'allchannel';

describe('deploy', function () {
	this.timeout(0);

	it('install', async () => {
		await installAll(chaincodeID);
	});
	it('dev', async () => {
		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await dev(org, chaincodeID);
		}
	});
	it('query installed & approve', async () => {


		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			await smartApprove(org, chaincodeID, orderer);
		}

	});
	it('commit', async () => {
		// TODO migrate to testutil.js
		const org = 'icdd';
		await commit(org, chaincodeID, orderer);
	});
});
describe('invoke', function () {
	this.timeout(0);
	const peer = helper.newPeer(0, 'astri.org');
	const org = 'icdd';
	const user = new UserBuilder(undefined, helper.getOrgAdmin(org));

	const gateway = new FabricGateway(peer, user);
	const contract = gateway.getContract(channel, chaincodeID);

	it('touch', async () => {
		contract.subContract = 'StupidContract';
		await contract.evaluateTransaction('ping');
	});
	it('who', async () => {
		contract.subContract = 'SmartContract';
		const result = await contract.evaluateTransaction('who');
		logger.info(result);
	});
	it('touch submit', async () => {
		contract.subContract = 'StupidContract';
		await contract.submitTransaction('ping');

	});
	it('p1e', async () => {
		await assert.rejects(async () => {
			await contract.evaluateTransaction('StupidContract:p1E');
		});
	});
	it('stress 10', async () => {
		for (let i = 0; i < 10; i++) {
			await contract.submitTransaction('ping');
		}
		for (let i = 0; i < 10; i++) {
			await contract.submit(['ping'], undefined, undefined, true);
		}
		for (let i = 0; i < 10; i++) {
			await contract.evaluateTransaction('ping');
		}
	});
});



