const chaincodeId = 'mainChain';
const {instantiate, upgradeToLatest} = require('../../app/instantiateHelper');
const {installAll, incrementInstalls} = require('../../app/installHelper');
const {invoke} = require('../../app/invokeHelper');
const helper = require('../../app/helper');
const logger = helper.getLogger('initNUpgrade');
const initConflict = async () => {
	const org2 = 'icdd';
	const org1 = 'ASTRI.org';

	await installAll(chaincodeId);
	let peers = [helper.newPeer(0, org2), helper.newPeer(0, org1)];
	await instantiate(org2, peers, chaincodeId, 'version', ['0.0.0']);
	peers = [helper.newPeer(1, org2), helper.newPeer(1, org1)];
	await instantiate(org2, peers, chaincodeId);// swallow when existence
};

const wrongInstall = async (org, peerIndexes, chaincodeVersion) => {
	const {install} = require('../../common/nodejs/chaincode');
	const chaincodePath = 'github.com/davidkhala/chaincode/golang/diagnose';
	const peers = helper.newPeers(peerIndexes, org);
	const client = await helper.getOrgAdmin(org);
	await install(peers, {chaincodeId, chaincodePath, chaincodeVersion}, client);
};
const upgradeConflict = async () => {
	const org2 = 'icdd';
	const org1 = 'ASTRI.org';
	const peers = [helper.newPeer(1, org2), helper.newPeer(1, org1)];
	const incrementResult = await incrementInstalls(chaincodeId, org2, [1]);
	logger.debug('incrementResult', incrementResult);

	const nextVersion = Object.values(incrementResult)[0];
	await upgradeToLatest(org2, peers[0], chaincodeId, 'version', ['0.0.1']);

	await wrongInstall(org1, [1], nextVersion);

	try {
		await invoke(peers, org2, chaincodeId, 'get', ['version']);

	} catch (e) {
		logger.debug('align error expected', e);
	}
};

const flow = async () => {

	await initConflict();
	await upgradeConflict();
};
flow();
