const {invoke} = require('./chaincodeHelper');
const {reducer} = require('../common/nodejs/chaincode');
const helper = require('./helper');

const logger = require('../common/nodejs/logger').new('testInvoke');
const chaincodeId = process.env.name?process.env.name:'node';
const fcn = '';
const args = [];
const peerIndexes = [0];
const orgName = helper.randomOrg('peer');
const channelName = 'allchannel';

const peers = helper.newPeers(peerIndexes, orgName);

const {sleep} = require('../common/nodejs/helper');
const task = async () => {
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args});
	const result = reducer({txEventResponses, proposalResponses});
	logger.info(result);
};
const run = async (times, interval = 10000) => {
	if (Number.isInteger(times)) {
		for (let i = 0; i < times; i++) {
			await task();
			await sleep(interval);
		}
	} else {
		await task();
		await sleep(interval);
		await run(times, interval);
	}
};
run(process.env.times,process.env.interval);

