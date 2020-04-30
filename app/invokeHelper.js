const helper = require('./helper');

require('khala-logger/log4js').consoleLogger('invokeHelper');
const {proposalStringify, proposalFlatten} = require('../common/nodejs/chaincode');
const {invoke, query} = require('./chaincodeHelper');
const channelName = 'allchannel';

const {chaincodeEvent, newEventHub} = require('../common/nodejs/eventHub');

const {sleep} = require('../common/nodejs/admin/helper').nodeUtil.helper();
exports.invoke = async (peers, clientPeerOrg, chaincodeId, fcn, args = [], transientMap) => {
	logger.debug('invoke', 'client org', clientPeerOrg);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const {proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args, transientMap});
	const result = proposalResponses.map((entry) => proposalFlatten(proposalStringify(entry)));
	logger.debug('invoke', result);
	return result;
};
exports.query = async (peers, clientOrg, chaincodeId, fcn, args = [], transientMap, rawPayload) => {
	logger.debug('query', 'client org', clientOrg);
	const client = await helper.getOrgAdmin(clientOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const {proposalResponses} = await query(channel, peers, {chaincodeId, fcn, args, transientMap});
	const result = proposalResponses.map((entry) => proposalFlatten(rawPayload ? entry : proposalStringify(entry)));
	return result;
};
exports.listenChaincodeEvent = async (peers, clientPeerOrg, chaincodeId, eventName = /event/i) => {
	const logger = require('khala-logger/log4js').consoleLogger('chaincode event');
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
