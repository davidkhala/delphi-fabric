const helper = require('../../../app/helper');
const chaincodeID = 'diagnose';

const {installAll, queryDefinition, checkCommitReadiness, commitChaincodeDefinition, approves} = require('../../../app/installHelper');
const logger = require('khala-logger/log4js').consoleLogger('chaincode:diagnose');
const QueryHub = require('../../../common/nodejs/query');
const orderers = helper.newOrderers();
const orderer = orderers[0];
const gate = `AND('icddMSP.member', 'astriMSP.member')`;
describe('install and approve', () => {
	const allPeers = helper.allPeers();

	let PackageIDs;
	it('install', async function () {
		this.timeout(30000 * allPeers.length);
		PackageIDs = await installAll(chaincodeID);
		logger.debug('package id map', PackageIDs);
	});
	const queryInstalledAndApprove = async (sequence, _gate) => {
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			for (const peer of peers) {
				await peer.connect();
			}
			const user = helper.getOrgAdmin(org);
			const queryHub = new QueryHub(peers, user);
			const queryResult = await queryHub.chaincodesInstalled(chaincodeID);
			let PackageID;
			for (const entry of queryResult) {
				const _PackageIDs = Object.keys(entry);
				for (const reference of Object.values(entry)) {
					for (const [channelName, {chaincodes}] of Object.entries(reference)) {
						logger.debug(channelName, chaincodes);
					}
				}
				if (_PackageIDs.length > 1) {
					logger.error('found multiple installed packageID');
					logger.info(queryResult);
				} else {
					PackageID = _PackageIDs[0];
				}
			}
			if (PackageID) {
				await approves({PackageID, sequence}, org, peers, orderer, _gate);
			}

		}
	};
	it('query installed & approve', async function () {
		this.timeout(30000 * allPeers.length);
		const sequence = 1;
		await queryInstalledAndApprove(sequence);
	});
	it.skip('query installed & approve: with gate', async () => {
		const sequence = 2;
		await queryInstalledAndApprove(sequence, gate);
	});
});
describe('commit', () => {


	const queryCommitReadiness = async (sequence, _gate) => {
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			const readyState = await checkCommitReadiness({name: chaincodeID, sequence}, org, peers, _gate);
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
		await commitChaincodeDefinition({name: _chaincodeID, sequence}, 'astri.org', peers, orderer, _gate);
	};
	it('commit', async () => {
		await commit(chaincodeID, 1);
	});
	it.skip('commit: with gate', async () => {
		await commit(chaincodeID, 2, gate);
	});


	it('query definition', async () => {
		const r1 = await queryDefinition('icdd', [0, 1], chaincodeID);
		logger.debug(r1);
		logger.debug(r1[0].collections.config[0].static_collection_config);
		logger.debug(r1[0].collections.config[0].static_collection_config.endorsement_policy);
		const r2 = await queryDefinition('astri.org', [0, 1], chaincodeID);
	});


});
