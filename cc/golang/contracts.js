import assert from 'assert';
import * as helper from '../../app/helper.js';
import {installAll, ChaincodeDefinitionOperator} from '../../app/installHelper.js';
import FabricGateway from '../../common/nodejs/fabric-gateway/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../../common/nodejs/admin/user.js';

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
	const sequence = 1;
	it('query installed & approve', async () => {


		const orgs = ['icdd', 'astri.org'];
		for (const org of orgs) {
			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.connect();
			await operator.queryInstalledAndApprove(chaincodeID, sequence, orderer);
			await operator.disconnect();
		}

	});
	it('commit', async () => {
		const org = 'icdd';
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.commitChaincodeDefinition({name: chaincodeID, sequence}, orderer);
		await operator.disconnect();
	});
});
describe('invoke', function ()  {
	this.timeout(0)
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
		console.debug(result);
	});
	it('touch submit', async () => {
		contract.subContract = 'StupidContract';
		await contract.submitTransaction('ping');

	});
	it('panic', async () => {
		assert.throws(async () => {
			await contract.evaluateTransaction('StupidContract:panic');
		});


	});
});



