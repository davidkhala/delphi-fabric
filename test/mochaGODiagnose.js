const helper = require('../app/helper');

const chaincodeID = 'diagnose';

const {installAll, queryDefinition, checkCommitReadiness, commitChaincodeDefinition} = require('../app/installHelper');
const {approves} = require('../app/installHelper');
const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');

const {sleep} = require('khala-light-util');
const sequence = process.env.sequence ? parseInt(process.env.sequence) : 1;
const orderers = helper.newOrderers();
const orderer = orderers[0];
describe('install and approve', async function () {
	this.timeout(30000);
	let PackageIDs;
	it('install', async () => {
		PackageIDs = await installAll(chaincodeID);
		logger.debug('package id map', PackageIDs);
	});
	it('approve', async () => {
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			await approves({PackageID: PackageIDs[org], sequence}, org, peers, orderer);
		}
	});
});
describe('commit', () => {


	it('query commit Readiness', async () => {
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			await checkCommitReadiness({name: chaincodeID, sequence}, org, peers);
		}
	});

	it('commit', async () => {
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		await commitChaincodeDefinition({name: chaincodeID, sequence}, 'astri.org', peers, orderer);
	});


	it('query definition', async () => {
		await queryDefinition('icdd', [0, 1]);
		await queryDefinition('astri.org', [0, 1]);
	});


});