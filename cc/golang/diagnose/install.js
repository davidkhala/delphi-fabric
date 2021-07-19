const helper = require('../../../app/helper');
const chaincodeID = 'diagnose';

const {installAll, ChaincodeDefinitionOperator} = require('../../../app/installHelper');

const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');
const orderers = helper.newOrderers();
const orderer = orderers[0];
const gate = `AND('icddMSP.member', 'astriMSP.member')`;
const init_required = true;
const {channel = 'allchannel'} = process.env;

describe(`install and approve ${chaincodeID}`, () => {

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
			const admin = helper.getOrgAdmin(org);
			const peers = helper.newPeers([0, 1], org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.connect();
			await operator.queryInstalledAndApprove(chaincodeID, sequence, orderer);
		}

	});
	it.skip('query installed & approve: with gate', async function () {
		this.timeout(300000);
		const sequence = 2;
		const org = 'icdd';
		const admin = helper.getOrgAdmin(org);
		const peers = helper.newPeers([0, 1], org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.queryInstalledAndApprove(chaincodeID, sequence, orderer, gate);
	});
});
describe(`commit ${chaincodeID}`, () => {


	const queryCommitReadiness = async (sequence, _gate) => {
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			const admin = helper.getOrgAdmin(org);
			const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
			await operator.connect();
			const readyState = await operator.checkCommitReadiness({name: chaincodeID, sequence}, _gate);
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
		const org = 'icdd';
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		await operator.commitChaincodeDefinition({name: _chaincodeID, sequence}, orderer, _gate);
	};
	it('commit', async function () {
		this.timeout(30000);
		await commit(chaincodeID, 1);
	});
	it.skip('commit: with gate', async () => {
		await commit(chaincodeID, 2, gate);
	});


	it('query definition', async () => {
		const org = 'icdd';
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		const admin = helper.getOrgAdmin(org);
		const operator = new ChaincodeDefinitionOperator(channel, admin, peers, init_required);
		await operator.connect();
		const r1 = await operator.queryDefinition('icdd', [0, 1], chaincodeID);
		logger.debug(r1);
		logger.debug(r1[0].collections.config[0].static_collection_config);
		logger.debug(r1[0].collections.config[0].static_collection_config.endorsement_policy);
		const r2 = await operator.queryDefinition('astri.org', [0, 1], chaincodeID);
	});


});
