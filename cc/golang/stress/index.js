const helper = require('../../../app/helper');
const chaincodeID = 'stress';

const {installAll, ChaincodeDefinitionOperator} = require('../../../app/installHelper');

const logger = require('khala-logger/log4js').consoleLogger(`chaincode:${chaincodeID}`);
const orderers = helper.newOrderers();
const orderer = orderers[0];
const {channel = 'allchannel'} = process.env;
const init_required = true;

describe('deploy', () => {
	let packageIds = [];
	it('install', async function () {
		this.timeout(60000);
		packageIds = await installAll(chaincodeID);
		logger.debug(packageIds);
	});
	it('query installed & approve', async function () {

		const sequence = 1;
		const orgs = ['icdd', 'astri.org'];

		for (const org of orgs) {
			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.queryInstalledAndApprove(chaincodeID, sequence, orderer);
		}

	});
	it('commit', async () => {
		const org = 'icdd';
		const sequence = 1;
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.commitChaincodeDefinition({name: chaincodeID, sequence}, orderer);
	});
});



