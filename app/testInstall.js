const {install} = require('../common/nodejs/chaincode');
const {instantiate} = require('./chaincodeHelper');
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testInstall');
const chaincodeConfig = require('../config/chaincode.json');
const chaincodeId = 'adminChaincode';

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
	await deploy('BU.Delphi.com', [0]);
	await deploy('ENG.Delphi.com', [0]);
	await deploy('PM.Delphi.com', [0]);
	await deploy('ASTRI.Delphi.com', [0]);
	const orgName = 'BU.Delphi.com';
	const peers = helper.newPeers([0], orgName);
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	return instantiate(channel, peers, {chaincodeId, chaincodeVersion, args: instantiate_args});
};
task().catch(err => {
	logger.error(err);
});

//todo query installed
