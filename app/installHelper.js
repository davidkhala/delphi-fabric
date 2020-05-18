const {install, prepareInstall} = require('./chaincodeHelper');
const helper = require('./helper');
const {incrementInstall} = require('../common/nodejs/chaincodeVersion');

const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;

const channelName = 'allchannel';
// only one time, one org could deploy
exports.installs = async (chaincodeId, orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const t1 = await install(peers, {chaincodeId}, user);
	// t1(); FIXME debug
};

exports.installAll = async (chaincodeId) => {
	for (const [peerOrg, config] of Object.entries(channels[channelName].organizations)) {
		const {peerIndexes} = config;
		await exports.installs(chaincodeId, peerOrg, peerIndexes);
	}
};


exports.incrementInstalls = async (chaincodeId, orgName, peerIndexes) => {
	const result = {};
	const client = await helper.getOrgAdmin(orgName);
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		const opt = await prepareInstall({chaincodeId});
		const {chaincodeVersion} = await incrementInstall(peer, opt, client);
		result[peer.getName()] = chaincodeVersion;
	}
	return result;
};
exports.incrementInstallAll = async (chaincodeId) => {
	let result = {};
	const orgsConfig = channels[channelName].organizations;
	for (const orgName in orgsConfig) {
		const {peerIndexes} = orgsConfig[orgName];
		const temp = await exports.incrementInstalls(chaincodeId, orgName, peerIndexes);
		result = Object.assign(result, temp);
	}
	return result;
};
