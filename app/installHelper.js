const {install, prepareInstall} = require('./chaincodeHelper');
const helper = require('./helper');
const {nextVersion} = require('khala-nodeutils/version');
const {incrementInstall} = require('../common/nodejs/chaincodeVersion');

const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;

const channelName = 'allchannel';
// only one time, one org could deploy
exports.installs = async (chaincodeId, orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);
	const chaincodeVersion = nextVersion();
	return install(peers, {chaincodeId, chaincodeVersion}, client);
};

exports.installAll = async (chaincodeId) => {
	for (const [peerOrg, config] of Object.entries(channels[channelName].orgs)) {
		const {peerIndexes} = config;
		await exports.installs(chaincodeId, peerOrg, peerIndexes);
	}
};


exports.incrementInstalls = async (chaincodeId, orgName, peerIndexes) => {
	const client = await helper.getOrgAdmin(orgName);
	const peers = helper.newPeers(peerIndexes, orgName);
	const opt = await prepareInstall({chaincodeId});
	await incrementInstall(peers, opt, client);
};
exports.incrementInstallAll = async (chaincodeId) => {
	const orgsConfig = channels[channelName].orgs;
	for (const orgName in orgsConfig) {
		const {peerIndexes} = orgsConfig[orgName];
		await exports.incrementInstalls(chaincodeId, orgName, peerIndexes);
	}
};
