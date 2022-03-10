import * as helper from '../../../app/helper.js';
import {installAll, ChaincodeDefinitionOperator} from '../../../app/installHelper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const chaincodeID = 'ecosystem';
const logger = consoleLogger(`chaincode:${chaincodeID}`);
const orderers = helper.newOrderers();
const orderer = orderers[0];
const {channel = 'allchannel'} = process.env;

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
	});
});