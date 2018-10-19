const helper = require('./helper');

const LogUtil = require('../common/nodejs/logger');
const {reducer} = require('../common/nodejs/chaincode');
const {invoke} = require('./chaincodeHelper');
const channelName = 'allchannel';

const {chaincodeEvent, newEventHub} = require('../common/nodejs/eventHub');

const {sleep} = require('../common/nodejs/helper');
exports.invoke = async (peers, clientPeerOrg, chaincodeId, fcn, args = [], transientMap) => {
	const logger = LogUtil.new('invokeHelper', true);
	logger.debug('client org', clientPeerOrg);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args, transientMap});
	const result = reducer({txEventResponses, proposalResponses});
	logger.debug(result);
	return result.responses;
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
exports.looper = async (times, interval = 1000, task, ...taskParams) => {
	if (Number.isInteger(times)) {
		for (let i = 0; i < times; i++) {
			await task(...taskParams);
			await sleep(interval);
		}
	} else {
		// if (!eventHandler) {
		// 	eventHandler = await getChaincodeEvent();
		// }
		await task(taskParams);
		await sleep(interval);
		await exports.looper(times, interval);
	}
};
// run(process.env.times, process.env.interval);
