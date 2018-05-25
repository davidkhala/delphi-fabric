const helper = require('./helper.js');
const logger = require('../common/nodejs/logger').new('invoke-chaincode');
const eventHelper = require('../common/nodejs/eventHub');
const {resultWrapper,chaincodeProposalAdapter} = require('../common/nodejs/chaincode');
/**
 *
 * @param channel
 * @param richPeers
 * @param chaincodeId
 * @param fcn
 * @param args
 * @param client
 * @return {Promise.<TResult>}
 */
exports.invoke = async (channel, richPeers, {chaincodeId, fcn, args}, client = channel._clientContext) => {
	logger.debug({channelName: channel.getName(), peersSize: richPeers.length, chaincodeId, fcn, args});
	const {eventWaitTime} = channel;
	const txId = client.newTransactionID();

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: richPeers //optional: use channel.getPeers() as default
	};
	const [responses, proposal, header] = await channel.sendTransactionProposal(request);
	const ccHandler = chaincodeProposalAdapter('invoke');
	const {nextRequest, errCounter} = ccHandler([responses, proposal, header]);

	const {proposalResponses} = nextRequest;

	if (errCounter > 0) {
		throw {proposalResponses};
	}
	const promises = [];

	for (const peer of richPeers) {
		const eventhub = helper.bindEventHub(peer, client);
		const txPromise = eventHelper.txEventPromise(eventhub, {txId, eventWaitTime}, ({tx, code}) => {
			return {valid: code === 'VALID', interrupt: true};
		});
		promises.push(txPromise);
	}

	await channel.sendTransaction(nextRequest);

	const txEventResponses = await Promise.all(promises);
	return resultWrapper(txEventResponses, {proposalResponses});

};


exports.query = async (channel, peers, {chaincodeId, fcn, args}, client = channel._clientContext) => {
	logger.debug('query', {channelName: channel.getName(), peersSize: peers.length, chaincodeId, fcn, args});
	const txId = client.newTransactionID();

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: peers //optional: use channel.getPeers() as default
	};
	const results = await channel.queryByChaincode(request);
	return results.map(e => e.toString());

};
