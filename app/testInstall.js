const { instantiate, install } = require('./chaincodeHelper');
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testInstall');

const chaincodeId = process.env.name ? process.env.name : 'node';
const globalConfig = require('../config/orgs.json');
const { channels } = globalConfig;

const instantiate_args = [];

const chaincodeVersion = 'v0';
const channelName = 'allchannel';
const chaincodeType = 'node';
//only one time, one org could deploy
const deploy = async (orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);
	return install(peers, { chaincodeId, chaincodeVersion, chaincodeType }, client);
};

const task = async () => {
	try {

		for (const [peerOrg, config] of Object.entries(channels[channelName].orgs)) {
			const { peerIndexes } = config;
			await deploy(peerOrg, peerIndexes);
		}

		const peerOrg = 'ASTRI.org';
		const { peerIndexes } = channels[channelName].orgs[peerOrg];//For random
		const peers = helper.newPeers(peerIndexes, peerOrg);
		const client = await helper.getOrgAdmin(peerOrg);
		const channel = helper.prepareChannel(channelName, client, true);
		return instantiate(channel, peers, { chaincodeId, chaincodeVersion, args: instantiate_args, chaincodeType });
	} catch (e) {
		logger.error(e);
		process.exit(1);
	}
};
task();

