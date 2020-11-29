const {installAll, commitChaincodeDefinition, approves} = require('../../../app/installHelper');

const chaincodeId = 'nodeDiagnose';
const helper = require('../../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger(chaincodeId);
describe(`install ${chaincodeId}`, function () {
	const allPeers = helper.allPeers();
	this.timeout(30000 * allPeers.length);
	it('install', async () => {
		const PackageIDs = await installAll(chaincodeId);
		logger.debug('package id map', PackageIDs);

	});


});

describe('approve', () => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const queryInstalledAndApprove = async (sequence, _orderer, _gate) => {
		const QueryHub = require('../../../common/nodejs/query');
		for (const org of ['icdd', 'astri.org']) {
			const peers = helper.newPeers([0, 1], org);
			for (const peer of peers) {
				await peer.connect();
			}
			const user = helper.getOrgAdmin(org);
			const queryHub = new QueryHub(peers, user);
			const queryResult = await queryHub.chaincodesInstalled(chaincodeId);
			let PackageID;
			for (const entry of queryResult) {
				const PackageIDs = Object.keys(entry);
				for (const reference of Object.values(entry)) {
					for (const [channelName, {chaincodes}] of Object.entries(reference)) {
						logger.debug(channelName, chaincodes);
					}
				}
				if (PackageIDs.length > 1) {
					logger.error('found multiple installed packageID');
					logger.info(queryResult);
					logger.info({PackageIDs: PackageIDs});
				} else {
					PackageID = PackageIDs[0];
				}
			}
			if (PackageID) {
				await approves({PackageID, sequence}, org, peers, _orderer, _gate);
			}

		}
	};
	it('approves', async () => {
		const sequence = 1;
		await queryInstalledAndApprove(sequence, orderer);
	});
});
describe('commit', () => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const commit = async (_chaincodeID, sequence, _gate) => {
		const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
		await commitChaincodeDefinition({name: _chaincodeID, sequence}, 'astri.org', peers, orderer, _gate);
	};
	it('commit', async () => {
		await commit(chaincodeId, 1);

	});
});
