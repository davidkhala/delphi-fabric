import {installAll, ChaincodeDefinitionOperator} from '../../../app/installHelper.js';
import * as helper from '../../../app/helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js'
const chaincodeId = 'nodeDiagnose';
const logger = consoleLogger(chaincodeId);
const init_required = true;
describe(`install ${chaincodeId}`, () => {

	it('install', async function () {
		this.timeout(0);
		const PackageIDs = await installAll(chaincodeId);
		logger.debug('package id map', PackageIDs);

	});


});

describe('approve', () => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];

	it('approves', async function () {
		const orgs = ['icdd', 'astri.org'];
		this.timeout(0);
		const sequence = 1;

		for (const org of orgs) {

			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator('allchannel', admin, peers, init_required);
			await operator.queryInstalledAndApprove(chaincodeId, sequence, orderer);
		}

	});
});
describe('commit', () => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];

	it('commit', async () => {

		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin('icdd');
		const operator = new ChaincodeDefinitionOperator('allchannel', admin, peers, init_required);
		await operator.commitChaincodeDefinition({name: chaincodeId, sequence: 1}, orderer);
	});
});
