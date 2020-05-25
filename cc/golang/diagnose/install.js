const {installAll, queryDefinition, checkCommitReadiness, commitChaincodeDefinition} = require('../../../app/installHelper');
const helper = require('../../../app/helper');
const {approves} = require('../../../app/installHelper');
const {chaincodesInstalled} = require('../../../common/nodejs/query');
const logger = require('khala-logger/log4js').consoleLogger('diagnose install');
const diagnose = 'diagnose';
const orderers = helper.newOrderers();
const orderer = orderers[0];
const {sleep} = require('khala-light-util');
const sequenceEnv = process.env.sequence ? parseInt(process.env.sequence) : 1;
const taskApprove = async (PackageIDs, sequence) => {
	for (const org of ['icdd', 'astri.org']) {
		const peers = helper.newPeers([0, 1], org);
		await approves({PackageID: PackageIDs[org], sequence}, org, peers, orderer);
	}
};
const taskCheckCommitReadiness = async (chaincodeID, sequence) => {
	for (const org of ['icdd', 'astri.org']) {
		const peers = helper.newPeers([0, 1], org);
		await checkCommitReadiness({name: chaincodeID, sequence}, org, peers);
	}

};
const taskCommitChaincodeDefinition = async (chaincodeID, sequence) => {
	const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
	await commitChaincodeDefinition({name: chaincodeID, sequence}, 'astri.org', peers, orderer);
};
const taskQueryDefinition = async () => {
	await queryDefinition('icdd', [0]);
	await queryDefinition('astri.org', [0]);
};
const task = async () => {

	switch (parseInt(process.env.taskID)) {
		case 2: {
			await taskQueryDefinition();
		}
			break;
		case 3: {
			// TODO with same source we could get different package hash
			const org = 'astri.org';
			const peers = helper.newPeers([0, 1], org);
			const user = helper.getOrgAdmin(org);
			const result = await chaincodesInstalled(peers, user);
			console.debug(result);
		}
			break;

		default: {
			// node cc/golang/diagnose/install.js
			const packageIDs = await installAll(diagnose);
			logger.debug('package id map', packageIDs);
			await taskApprove(packageIDs, sequenceEnv);
			await taskCheckCommitReadiness(diagnose, sequenceEnv);
			await taskCommitChaincodeDefinition(diagnose, sequenceEnv);
			await taskQueryDefinition();


		}
	}

};
task();
