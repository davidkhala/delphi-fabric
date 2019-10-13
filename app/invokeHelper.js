const helper = require('./helper');

const LogUtil = require('../common/nodejs/logger');
const logger = LogUtil.new('invokeHelper', true);
const {proposalStringify, proposalFlatten} = require('../common/nodejs/chaincode');
const {invoke, query} = require('./chaincodeHelper');
const channelName = 'allchannel';

const {chaincodeEvent, newEventHub} = require('../common/nodejs/eventHub');

const {sleep} = require('../common/nodejs/helper').nodeUtil.helper;
exports.invoke = async (peers, clientPeerOrg, chaincodeId, fcn, args = [], transientMap, commitPeers = []) => {
	logger.debug('invoke', 'client org', clientPeerOrg);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	let eventHubs = undefined;
	if (commitPeers.length > 0) {
		eventHubs = commitPeers.map(peer => {
			return newEventHub(channel, peer, true);
		});
	}
	const {proposalResponses} = await invoke(channel, peers, {
		chaincodeId,
		fcn,
		args,
		transientMap
	}, undefined, eventHubs);
	const result = proposalResponses.map((entry) => proposalFlatten(proposalStringify(entry)));
	logger.debug('invoke', result);
	return result;
};
exports.query = async (peers, clientOrg, chaincodeId, fcn, args = [], transientMap, rawPayload) => {
	logger.debug('query', 'client org', clientOrg);
	const client = await helper.getOrgAdmin(clientOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const {proposalResponses} = await query(channel, peers, {chaincodeId, fcn, args, transientMap});
	return proposalResponses.map((entry) => proposalFlatten(rawPayload ? entry : proposalStringify(entry)));
};
exports.listenChaincodeEvent = async (peer, clientPeerOrg, chaincodeId, eventName = /event/i, onSuccess) => {
	const logger = LogUtil.new('chaincode event', true);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const eventHub = newEventHub(channel, peer, true);
	const validator = (data) => {
		logger.debug('default validator', data);
		return {valid: true, interrupt: false};
	};
	return chaincodeEvent(eventHub, validator, {chaincodeId, eventName}, onSuccess, (err) => {
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
