const {installAll, queryDefinition, checkCommitReadiness, commitChaincodeDefinition} = require('../../../app/installHelper');
const helper = require('../../../app/helper');
const {approves} = require('../../../app/installHelper');
const {chaincodesInstalled} = require('../../../common/nodejs/query');
const diagnose = 'diagnose';
const orderers = helper.newOrderers();
const orderer = orderers[0];
const {sleep} = require('khala-light-util');
const sequenceEnv = process.env.sequence ? parseInt(process.env.sequence) : 1;
const taskApprove = async (PackageID, sequence) => {
	let peers = [helper.newPeer(0, 'icdd')];
	await approves({PackageID, sequence}, 'icdd', peers, orderer);
	peers = [helper.newPeer(0, 'astri.org')];
	await approves({PackageID, sequence}, 'astri.org', peers, orderer);
};
const taskCheckCommitReadiness = async (PackageID, sequence) => {
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	await checkCommitReadiness({PackageID, sequence}, 'icdd', peers);
};
const taskCommitChaincodeDefinition = async (PackageID, sequence) => {
	const peers = [helper.newPeer(0, 'astri.org'), helper.newPeer(0, 'icdd')];
	await commitChaincodeDefinition({PackageID, sequence}, 'astri.org', peers, orderer);
};
const taskQueryDefinition = async () => {
	await queryDefinition('icdd', [0]);
	await queryDefinition('astri.org', [0]);
	await sleep(1000); // TODO data disseminate or preparation time ?
	await queryDefinition('icdd', [0]);
	await queryDefinition('astri.org', [0]);
	// await queryDefinition('icdd', [0], diagnose);
	// await queryDefinition('astri.org', [0]);
};
const task = async () => {

	switch (parseInt(process.env.taskID)) {
		case 0: {
			const packageID = await installAll(diagnose);
			console.info(packageID);
		}
			break;
		case 1: {
			// taskID=1 node cc/golang/diagnose/install.js
			const packageId = 'diagnose:d35e8f41f4d0ad7305b69da501695945fb938f6a3a494630a52e65fb98b02222';
			await taskApprove(packageId, 1);

		}
			break;
		case 2: {
			await taskQueryDefinition();
		}
			break;
		case 3: {
			const peer = helper.newPeer(0, 'icdd');
			const user = helper.getOrgAdmin('icdd');
			const result = await chaincodesInstalled(peer, user);
			console.debug(result);
		}
			break;

		default: {
			// node cc/golang/diagnose/install.js
			const packageID = await installAll(diagnose);
			console.log({packageID});
			await taskApprove(packageID, sequenceEnv);
			await taskCheckCommitReadiness(packageID, sequenceEnv);
			await taskCommitChaincodeDefinition(packageID, sequenceEnv);
			await taskQueryDefinition();


		}
	}

};
task();
