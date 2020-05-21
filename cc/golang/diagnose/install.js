const {installAll, queryDefinition, checkCommitReadiness, commitChaincodeDefinition} = require('../../../app/installHelper');
const LifecycleProposal = require('../../../common/nodejs/admin/lifecycleProposal');
const helper = require('../../../app/helper');
const UserUtil = require('../../../common/nodejs/admin/user');
const {approves} = require('../../../app/installHelper');
const {sleep} = require('khala-light-util');
const diagnose = 'diagnose';
const orderers = helper.newOrderers();
const orderer = orderers[0];
const sequence = process.env.sequence ? parseInt(process.env.sequence) : 1;
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
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'astri.org')];
	await commitChaincodeDefinition({PackageID, sequence}, 'icdd', peers, orderer);
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
			//TODO return empty
			await queryDefinition(undefined, 'icdd', [0]);
		}
			break;
		case 3: {
			const channelName = 'allchannel';
			const peer = helper.newPeer(0, 'icdd');
			await peer.connect();
			const user = helper.getOrgAdmin('icdd');


			const lifecycleProposal = new LifecycleProposal(UserUtil.getIdentityContext(user), channelName, [peer.endorser]);
			const result = await lifecycleProposal.queryInstalledChaincodes();
			console.debug(result.responses.map(({response}) => response));
		}
			break;

		default: {

			const packageID = await installAll(diagnose);
			console.log({packageID});
			await taskApprove(packageID, sequence);
			await sleep(2000);
			await taskCheckCommitReadiness(packageID, sequence);
			await taskCommitChaincodeDefinition(packageID, sequence);

		}
	}

};
task();
