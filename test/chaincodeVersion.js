const {pruneChaincodeLegacy} = require('../common/nodejs/chaincodeVersion');
const channelName = 'allchannel';
const helper = require('../app/helper');
const logger = helper.getLogger('test:chaincodeVersion');

const chaincodeId = 'mainChain';
const {instantiate, upgradeToLatest} = require('../app/instantiateHelper');
const {installAll, incrementInstalls} = require('../app/installHelper');
const testInit = async () => {
	const org2 = 'icdd';
	const org1 = 'astri.org';
	await installAll(chaincodeId);
	const peers = [helper.newPeer(0, org2), helper.newPeer(0, org1)];
	await instantiate(org2, peers, chaincodeId, 'version', ['0.0.0']);
};
const testUpgrade = async () => {
	const org2 = 'icdd';
	const org1 = 'astri.org';
	let incrementResult = await incrementInstalls(chaincodeId, org2, [0, 1]);
	logger.debug('incrementResult', incrementResult);
	incrementResult = await incrementInstalls(chaincodeId, org1, [0, 1]);
	logger.debug('incrementResult', incrementResult);
	const nextVersion = Object.values(incrementResult)[0];
	await upgradeToLatest(org2, helper.newPeer(1, org2), chaincodeId, 'version', [nextVersion]);

};


const taskPruneChaincode = async () => {
	const org = 'icdd';

	const client = await helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client, true);
	const peer = helper.newPeer(1, org);
	await pruneChaincodeLegacy(peer, channel);
};
const task = async () => {
	// await testInit();
	// await testUpgrade();
	await taskPruneChaincode();
};
task();


