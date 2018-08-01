const { invoke } = require('./chaincodeHelper');
const { reducer } = require('../common/nodejs/chaincode');
const helper = require('./helper');

const logger = require('../common/nodejs/logger').new('testInvoke');
const chaincodeId = process.env.name ? process.env.name : 'node';
const fcn = '';
const args = [];
const globalConfig = require('../config/orgs.json');
const { channels } = globalConfig;
const peerIndexes = [0];

const channelName = 'allchannel';


const { chaincodeEvent, newEventHub } = require('../common/nodejs/eventHub');

const { sleep } = require('../common/nodejs/helper');
const task = async () => {
	const orgName = helper.randomOrg('peer');
	const { peerIndexes } = channels[channelName].orgs[orgName];
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	const { txEventResponses, proposalResponses } = await invoke(channel, peers, { chaincodeId, fcn, args });
	const result = reducer({ txEventResponses, proposalResponses });
	logger.info(result);
};
const getChaincodeEvent = async () => {
	const orgName = helper.randomOrg('peer');
	const chaincodeEventName = /event/i;
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	const eventHub = newEventHub(channel, peers[0], true);
	const validator = (data) => {
		logger.debug('default validator', data);
		return { valid: true, interrupt: false };
	};
	return chaincodeEvent(eventHub, validator, { chaincodeId, eventName: chaincodeEventName }, () => {
	}, (err) => {
		logger.error('onError', err);
	});
};
let eventHandler;
const run = async (times, interval = 1000) => {
	if (Number.isInteger(times)) {
		for (let i = 0; i < times; i++) {
			await task();
			await sleep(interval);
		}
	} else {
		if (!eventHandler) {
			eventHandler = await getChaincodeEvent();
		}
		await task();
		await sleep(interval);
		await run(times, interval);
	}
};
run(process.env.times, process.env.interval);

