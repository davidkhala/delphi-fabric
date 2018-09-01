const {invoke} = require('./app/chaincodeHelper');
const {reducer} = require('./common/nodejs/chaincode');
const helper = require('./app/helper');

const logger = require('./common/nodejs/logger').new('testInvoke',true);
const chaincodeId = process.env.name ? process.env.name : 'v1_2';

const channelName = 'allchannel';


const task = async (orgName, peerIndex, action) => {
	const peers = helper.newPeers([peerIndex], orgName);
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	// await channel.initialize();
	// const cPeers = channel.getPeers();
	// logger.debug(cPeers);
	const fcn = action;
	const args = [];
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args});
	const result = reducer({txEventResponses, proposalResponses});
	logger.info(result);
};
const flow = async () => {
	await task('ASTRI.org', 1, 'put');
	await task('ASTRI.org', 0, 'get');
};
flow();
