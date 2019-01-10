const helper = require('./helper');

const LogUtil = require('../common/nodejs/logger');
const logger = LogUtil.new('invokeHelper', true);
const {proposalStringify, proposalFlatten} = require('../common/nodejs/chaincode');
const {invoke, query} = require('./chaincodeHelper');
const channelName = 'allchannel';

const {chaincodeEvent, newEventHub} = require('../common/nodejs/eventHub');

const {sleep} = require('../common/nodejs/helper').nodeUtil.helper();
exports.invoke = async (peers, clientPeerOrg, chaincodeId, fcn, args = [], transientMap) => {
	logger.debug('client org', clientPeerOrg);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const {proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args, transientMap});
	const result = proposalResponses.map((entry) => proposalFlatten(proposalStringify(entry)));
	logger.debug(result);
	return result;
};
exports.query = async (peers, clientPeerOrg, chaincodeId, fcn, args = [], transientMap) => {
	logger.debug('client org', clientPeerOrg);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const {proposalResponses} = await query(channel, peers, {chaincodeId, fcn, args, transientMap});
	const result = proposalResponses.map((entry) => proposalFlatten(proposalStringify(entry)));
	return result;
};
exports.listenChaincodeEvent = async (peers, clientPeerOrg, chaincodeId, eventName = /event/i) => {
	const logger = LogUtil.new('chaincode event', true);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const eventHub = newEventHub(channel, peers[0], true);
	const validator = (data) => {
		logger.debug('default validator', data);
		return {valid: true, interrupt: false};
	};
	return chaincodeEvent(eventHub, validator, {chaincodeId, eventName}, () => {
	}, (err) => {
		logger.error('onError', err);
	});
};

const looper = async (opts = {interval: 1000}, task, ...taskParams) => {
	const {times, interval} = opts;

	if (Number.isInteger(times)) {
		for (let i = 0; i < times; i++) {
			await task(...taskParams);
			await sleep(interval);
		}
	} else {
		await task(...taskParams);
		await sleep(interval);
		await looper(opts, task, ...taskParams);
	}
};
exports.looper = looper;
