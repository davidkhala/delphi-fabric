const {pruneChaincodeLegacy} = require('../common/nodejs/chaincodeVersion');
const channelName = 'allchannel';
const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:chaincode');

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
	const channel = helper.prepareChannel(channelName, client);
	const peer = helper.newPeer(1, org);
	await pruneChaincodeLegacy(peer, channel, chaincodeId);
};
const task = async () => {

	const printInstalled = async (peer, client) => {
		const {getName} = require('../common/nodejs/formatter/peer');
		const {pretty} = await chaincodesInstalled(peer, client);
		console.log(getName(peer), pretty);
	};
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

			logger.info('before uninstall');
			await printInstalled(peer, client);
			const containerName = `peer${index}.${org}`;
			await uninstallChaincode({
				container_name: containerName,
				chaincodeId,
				chaincodeVersion: '0.0.0',
				peer,
				client
			});
			logger.info('after uninstall');
			await printInstalled(peer, client);
			await installs(chaincodeId, org, [index]);
			logger.info('after reinstall');
			await printInstalled(peer, client);
		}
			break;
		case 2: {
			// taskID=2 node test/chaincodeTest
			// install chaincode via chaincode package
			const {install} = require('../common/nodejs/chaincode');
			const globalConfig = require('../config/orgs.json');
			const {channels} = globalConfig;

			const chaincodePackage = '/home/davidliu/Documents/delphi-fabric/diagnose-0.0.0.chaincodePack';
			for (const [peerOrg, config] of Object.entries(channels[channelName].orgs)) {
				const {peerIndexes} = config;
				const peers = helper.newPeers(peerIndexes, peerOrg);
				const client = helper.getOrgAdmin(peerOrg);
				await install(peers, {chaincodePackage}, client);
				for (const peer of peers) {
					await printInstalled(peer, client);
				}
			}
		}
			break;
		case 3: {
			// taskID=3 node test/chaincodeTest
			// instantiate chaincode only
			const org2 = 'icdd';
			const org1 = 'astri.org';
			const peers = [helper.newPeer(0, org2), helper.newPeer(0, org1)];
			await instantiate(org2, peers, chaincodeId);

		}
			break;
		case 4: {
			const org2 = 'icdd';
			const org1 = 'astri.org';
			const peers = [helper.newPeer(0, org2)];
			const {install} = require('../app/chaincodeHelper');
			const opts = {
				chaincodeId: 'diagnose',
				chaincodeVersion: '0.0.2',
			};
			const client = helper.getOrgAdmin(org2);
			await install(peers, opts, client);
		}
			break;
		default:
			await testInit();
			await testUpgrade();
	}

};
task();


