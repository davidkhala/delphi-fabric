const {pruneChaincodeLegacy} = require('../common/nodejs/chaincodeVersion');
const channelName = 'allchannel';
const helper = require('../app/helper');
const logger = helper.getLogger('test:chaincode');

const chaincodeId = 'diagnose';
const {instantiate} = require('../app/instantiateHelper');
const {installAll, incrementInstallAll, installs} = require('../app/installHelper');
const {chaincodesInstalled} = require('../common/nodejs/query');
const {uninstallChaincode} = require('../common/nodejs/fabric-dockerode');
const testInit = async () => {
	const org2 = 'icdd';
	const org1 = 'astri.org';
	await installAll(chaincodeId);
	const peers = [helper.newPeer(0, org2), helper.newPeer(0, org1)];
	await instantiate(org2, peers, chaincodeId);
};
const testUpgrade = async () => {
	const org2 = 'icdd';
	const org1 = 'astri.org';
	await incrementInstallAll(chaincodeId);
	const peers = [helper.newPeer(0, org2), helper.newPeer(0, org1)];
	await instantiate(org2, peers, chaincodeId);
};

const taskPruneChaincode = async () => {
	const org = 'icdd';

	const client = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client, true);
	const peer = helper.newPeer(1, org);
	await pruneChaincodeLegacy(peer, channel, chaincodeId);
};
const task = async () => {
	switch (parseInt(process.env.taskID)) {
		case 0:
			await taskPruneChaincode();
			break;
		case 1: {
			const org2 = 'icdd';
			const org = org2;
			const index = 0;
			const peer = helper.newPeer(index, org);
			const client = helper.getOrgAdmin(org2);
			const printInstalled = async () => {
				const {pretty} = await chaincodesInstalled(peer, client);
				console.log(pretty);
			};
			logger.info('before uninstall');
			await printInstalled();
			const containerName = `peer${index}.${org}`;
			await uninstallChaincode({container_name: containerName, chaincodeId, chaincodeVersion: '0.0.0', peer, client});
			logger.info('after uninstall');
			await printInstalled();
			await installs(chaincodeId, org, [index]);
			logger.info('after reinstall');
			await printInstalled();
		}
			break;
		default:
			await testInit();
			await testUpgrade();
	}

};
task();


