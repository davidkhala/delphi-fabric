import * as helper from '../../app/helper.js';
import {installAll, ChaincodeDefinitionOperator} from '../../app/installHelper.js';
import FabricGateway from '../../common/nodejs/fabric-gateway/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../../common/nodejs/admin/user.js';

const chaincodeID = 'stress';
const logger = consoleLogger(`chaincode:${chaincodeID}`);
const orderers = helper.newOrderers();
const orderer = orderers[0];
const channel = 'allchannel';

const init_required = false;

describe('deploy', function () {
	this.timeout(0);
	let packageIds = [];
	it('install', async () => {

		packageIds = await installAll(chaincodeID);
		logger.debug(packageIds);
	});
	it('query installed & approve', async () => {

		const sequence = 1;
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
		const sequence = 1;
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.commitChaincodeDefinition({name: chaincodeID, sequence}, orderer);
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

		await contract.evaluateTransaction();
	});
	it('stress 10', async () => {
		for (let i = 0; i < 10; i++) {
			await contract.submitTransaction();
		}
		for (let i = 0; i < 10; i++) {
			await contract.submit([], undefined, undefined, true);
		}
		for (let i = 0; i < 10; i++) {
			await contract.evaluateTransaction();
		}

	});
});



