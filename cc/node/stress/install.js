const {installAll, ChaincodeDefinitionOperator} = require('../../../app/installHelper');


const chaincodeId = 'nodeStress';
const helper = require('../../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger(chaincodeId);
describe(`install ${chaincodeId}`, () => {

	it('install', async function () {
		const allPeers = helper.allPeers();
		this.timeout(30000 * allPeers.length);
		const PackageIDs = await installAll(chaincodeId);
		logger.debug('package id map', PackageIDs);

	});


});

describe('approve', () => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const operator = new ChaincodeDefinitionOperator('allchannel');
	it('approves', async function () {
		const orgs = ['icdd', 'astri.org'];
		this.timeout(30000 * orgs.length);
		const sequence = 1;
		for (const org of orgs) {
			await operator.queryInstalledAndApprove(org, chaincodeId, sequence, orderer);
		}

	});
});
describe('commit', () => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const operator = new ChaincodeDefinitionOperator('allchannel');
	const commit = async (_chaincodeID, sequence, _gate) => {
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		await operator.commitChaincodeDefinition({name: _chaincodeID, sequence}, 'astri.org', peers, orderer, _gate);
	};
	it('commit', async () => {
		await commit(chaincodeId, 1);

	});
});
