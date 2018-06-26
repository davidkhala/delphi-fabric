const {install} = require('../common/nodejs/chaincode');
const {instantiate} = require('./chaincodeHelper');
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testInstall');
const chaincodeConfig = require('../config/chaincode.json');
const globalConfig = require('../config/orgs');
const chaincodeId = process.env.name ? process.env.name : 'adminChaincode';

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path;

const instantiate_args = [];

const chaincodeVersion = 'v0';
const channelName = 'allchannel';
//only one time, one org could deploy
const deploy = async (orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);

	const client = await helper.getOrgAdmin(orgName);
	return install(peers, {chaincodeId, chaincodePath, chaincodeVersion}, client);
};

const task = async () => {
	try {
		for (const peerOrg in globalConfig.orgs) {
			await deploy(peerOrg, [0]);
		}

		const peerOrg = helper.randomOrg('peer');
		const peers = helper.newPeers([0], peerOrg);
		const client = await helper.getOrgAdmin(peerOrg);
		const channel = helper.prepareChannel(channelName, client, true);
		return instantiate(channel, peers, {chaincodeId, chaincodeVersion, args: instantiate_args});
	} catch (e) {
		logger.error(e);
		process.exit(1);
	}
};
task();

//todo query installed
