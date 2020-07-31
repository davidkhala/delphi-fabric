// TODO WIP
const helper = require('./helper');

const logger = require('khala-logger/log4js').consoleLogger('transaction helper');
const channelName = 'allchannel';
const orderers = helper.newOrderers();
const orderer = orderers[0];
const Transaction = require('../common/nodejs/transaction');
const {EndorseALL} = require('../common/nodejs/endorseResultInterceptor');

exports.invoke = async (peers, clientOrg, chaincodeId, {fcn, args, transientMap, init}) => {
	logger.debug('invoke', 'client org', clientOrg);
	const user = helper.getOrgAdmin(clientOrg);
	const channel = helper.prepareChannel(channelName);
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const tx = new Transaction(peers, user, channel, logger);
	tx.build(chaincodeId, EndorseALL);

	return await tx.submit({fcn, args, transientMap, init}, orderer);
};
exports.query = async (peers, clientOrg, chaincodeId, {fcn, args, transientMap}) => {
	logger.debug('query', 'client org', clientOrg);
	const user = helper.getOrgAdmin(clientOrg);
	const channel = helper.prepareChannel(channelName);
	for (const peer of peers) {
		await peer.connect();
	}
	const tx = new Transaction(peers, user, channel, logger);
	tx.build(chaincodeId, EndorseALL);
	const result = await tx.evaluate({fcn, args, transientMap});

	result.queryResults = result.queryResults.map(entry => entry.toString());
	return result.queryResults;
};
// exports.listenChaincodeEvent = async (peers, clientPeerOrg, chaincodeId, eventName = /event/i) => {
// 	const logger = require('khala-logger/log4js').consoleLogger('chaincode event');
// 	const client = await helper.getOrgAdmin(clientPeerOrg);
// 	const channel = helper.prepareChannel(channelName, client, true);
// 	const eventHub = newEventHub(channel, peers[0], true);
// 	const validator = (data) => {
// 		logger.debug('default validator', data);
// 		return {valid: true, interrupt: false};
// 	};
// 	return chaincodeEvent(eventHub, validator, {chaincodeId, eventName}, () => {
// 	}, (err) => {
// 		logger.error('onError', err);
// 	});
// };

