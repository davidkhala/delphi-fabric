const {pruneChaincodeLegacy} = require('../common/nodejs/chaincodeVersion');
const channelName = 'allchannel';
const helper = require('../app/helper');
const logger = helper.getLogger('test:chaincodeVersion');

const chaincodeId = 'mainChain';
const {instantiate} = require('../app/instantiateHelper');
const {installAll} = require('../app/installHelper');
const testInit = async () => {
	const org2 = 'icdd';
	const org1 = 'astri.org';
	await installAll(chaincodeId);
	const peers = [helper.newPeer(0, org2), helper.newPeer(0, org1)];
	await instantiate(org2, peers, chaincodeId, 'version', ['0.0.0']);
};

const taskPruneChaincode = async () => {
	const org = 'icdd';

	const client = helper.getOrgAdmin(org, 'peer');
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


