const {installAll, incrementInstallAll, installs} = require('../../../app/installHelper');
const {instantiate} = require('../../../app/instantiateHelper');

const chaincodeId = 'diagnose';
const helper = require('../../../app/helper');
exports.task = async (channelName, step) => {
	const step1 = async () => incrementInstallAll(chaincodeId);
	const step2 = async () => {
		const org1 = 'astri.org';
		const org2 = 'icdd';
		const p1 = helper.newPeer(0, org1);
		const p2 = helper.newPeer(0, org2);
		const transientMap = {
			key: 'david'
		};
		await instantiate(org1, [p1, p2], chaincodeId, 'init', [], transientMap, channelName);
	};
	switch (step) {
		case 1:
			await step1();
			break;
		case 2:
			await step2();
			break;
		default:
			await step1();
			await step2();
	}

};
exports.taskAttach = async () => {
	const prone = 'mainChain';
	await installAll(prone);
	const org1 = 'astri.org';
	const org2 = 'icdd';
	const p1 = helper.newPeer(0, org1);
	const p2 = helper.newPeer(0, org2);
	await instantiate(org1, [p1, p2], prone, 'init', ['FixsdkDefaultFcn==init']);
};

exports.partialInstall = async (orgName, peerIndexes) => {
	await installs(chaincodeId, orgName, peerIndexes);
	const org1 = orgName;
	const peers = helper.newPeers([0], org1);
	await instantiate(org1, peers, chaincodeId);
};
