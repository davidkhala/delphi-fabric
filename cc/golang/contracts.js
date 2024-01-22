import assert from 'assert';
import * as helper from '../../app/helper.js';
import {installAll, ChaincodeDefinitionOperator} from '../../app/installHelper.js';
import FabricGateway from '../../common/nodejs/fabric-gateway/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../../common/nodejs/admin/user.js';
import {dev} from '../testutil.js';

const chaincodeID = 'contracts';
const logger = consoleLogger(`chaincode:${chaincodeID}`);
const orderers = helper.newOrderers();
const orderer = orderers[0];
const channel = 'allchannel';

const init_required = false;

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
			// TODO migrate to testutil.js
			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.connect();
			await operator.queryInstalledAndApprove(chaincodeID, orderer);
			await operator.disconnect();
		}

	});
	it('commit', async () => {
		// TODO migrate to testutil.js
		const org = 'icdd';
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.queryAndCommit(chaincodeID, orderer);
		await operator.disconnect();
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
			await contract.evaluateTransaction('StupidContract:P1E');
		});
		await assert.rejects(async () => {
			await contract.evaluateTransaction('StupidContract:p1E');
		});


	});
});



