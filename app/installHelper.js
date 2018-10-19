const {install} = require('./chaincodeHelper');
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('installHelper');

const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;

const channelName = 'allchannel';
//only one time, one org could deploy
exports.installs = async (chaincodeId, orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);
	const chaincodeVersion = 'v0';
	return install(peers, {chaincodeId, chaincodeVersion,}, client);
};

exports.installAll = async (chaincodeId) => {
	for (const [peerOrg, config] of Object.entries(channels[channelName].orgs)) {
		const {peerIndexes} = config;
		await exports.installs(chaincodeId, peerOrg, peerIndexes);
	}
};

