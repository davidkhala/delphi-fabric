const helper = require('../../../app/helper');
const chaincodeID = 'diagnose';

const {installAll, ChaincodeDefinitionOperator} = require('../../../app/installHelper');

const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');
const orderers = helper.newOrderers();
const orderer = orderers[0];
const gate = `AND('icddMSP.member', 'astriMSP.member')`;
describe('install and approve', () => {

	const operator = new ChaincodeDefinitionOperator('allchannel');

	let PackageIDs;
	it('install', async function () {
		const allPeers = helper.allPeers();
		this.timeout(30000 * allPeers.length);
		PackageIDs = await installAll(chaincodeID);
		logger.debug('package id map', PackageIDs);
	});

	it('query installed & approve', async function () {

		const sequence = 1;
		const orgs = ['icdd', 'astri.org'];
		this.timeout(30000 * orgs.length);
		for (const org of orgs) {
			await operator.queryInstalledAndApprove(org, chaincodeID, sequence, orderer);
		}

	});
	it.skip('query installed & approve: with gate', async function () {
		this.timeout(300000);
		const sequence = 2;
		await operator.queryInstalledAndApprove(chaincodeID, sequence, orderer, gate);
	});
});
describe('commit', () => {

	const operator = new ChaincodeDefinitionOperator('allchannel');
	const queryCommitReadiness = async (sequence, _gate) => {
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			const readyState = await operator.checkCommitReadiness({name: chaincodeID, sequence}, org, peers, _gate);
			logger.info(org, readyState);
		}
	};
	it('query commit Readiness', async () => {
		await queryCommitReadiness(1);
	});
	it.skip('query commit Readiness: with gate', async () => {
		await queryCommitReadiness(2, gate);
	});

	const commit = async (_chaincodeID, sequence, _gate) => {
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		await operator.commitChaincodeDefinition({name: _chaincodeID, sequence}, 'astri.org', peers, orderer, _gate);
	};
	it('commit', async () => {
		await commit(chaincodeID, 1);
	});
	it.skip('commit: with gate', async () => {
		await commit(chaincodeID, 2, gate);
	});


	it('query definition', async () => {
		const r1 = await operator.queryDefinition('icdd', [0, 1], chaincodeID);
		logger.debug(r1);
		logger.debug(r1[0].collections.config[0].static_collection_config);
		logger.debug(r1[0].collections.config[0].static_collection_config.endorsement_policy);
		const r2 = await operator.queryDefinition('astri.org', [0, 1], chaincodeID);
	});


});
