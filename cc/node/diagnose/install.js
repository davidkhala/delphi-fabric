import {installAll, ChaincodeDefinitionOperator} from '../../../app/chaincodeOperator.js';
import * as helper from '../../../app/helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const chaincodeId = 'nodeDiagnose';
const logger = consoleLogger(chaincodeId);
const init_required = true;
describe(`install ${chaincodeId}`, function () {
	this.timeout(0);
	it('install', async () => {

		const PackageIDs = await installAll(chaincodeId);
		logger.debug('package id map', PackageIDs);

	});

});

describe('approve', function () {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	this.timeout(0);
	it('approves', async function () {
		const orgs = ['icdd', 'astri.org'];

		const sequence = 1;

		for (const org of orgs) {

			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator('allchannel', admin, peers, init_required);
			await operator.connect();
			await operator.queryInstalledAndApprove(chaincodeId, orderer);
		}

	});
});
describe('commit', function () {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	this.timeout(0);
	it('commit', async () => {

		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin('icdd');
		const operator = new ChaincodeDefinitionOperator('allchannel', admin, peers, init_required);
		await operator.connect();
		await operator.commitChaincodeDefinition({name: chaincodeId, sequence: 1}, orderer);
	});

	it('legacy init', async () => {
		const peers = helper.allPeers();
		const org = 'icdd';
		const user = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator('allchannel', user, peers);
		await operator.connect();
		await operator.init(chaincodeId, orderer);
	});

});
