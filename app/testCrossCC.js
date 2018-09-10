const {instantiate, install, invoke} = require('./chaincodeHelper');
const {reducer} = require('../common/nodejs/chaincode');

const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testInstall');

const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;

const instantiate_args = [];

const chaincodeVersion = 'v0';
const channelName = 'allchannel';
const mainChain = 'mainChain';
const sideChain = 'sideChain';

const taskInstall = async () => {
	try {

		const peerOrg = 'ASTRI.org';
		const {peerIndexes} = channels[channelName].orgs[peerOrg];//For random

		const peers = helper.newPeers(peerIndexes, peerOrg);
		const client = await helper.getOrgAdmin(peerOrg);
		const channel = helper.prepareChannel(channelName, client, true);

		await install(peers, {chaincodeId:mainChain, chaincodeVersion,}, client);
		await install(peers, {chaincodeId:sideChain, chaincodeVersion,}, client);

		await instantiate(channel, peers, {chaincodeId:mainChain, chaincodeVersion, args: instantiate_args});
		await instantiate(channel, peers, {chaincodeId:sideChain, chaincodeVersion, args: instantiate_args});

	} catch (e) {
		logger.error(e);
		process.exit(1);
	}
};


const taskInvoke = async () => {
	const org2 = 'ASTRI.org';
	let chaincodeId = 'mainChain';

	const peers = [helper.newPeers([0], org2)[0]];
	const client = await helper.getOrgAdmin(org2);
	const channel = helper.prepareChannel(channelName, client, true);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, args:[]});
	const result = reducer({txEventResponses, proposalResponses});
	logger.info(result);
};

const task = process.env.task;
const tasks = {
	invoke: taskInvoke,
	install: taskInstall,
};
tasks[task]();