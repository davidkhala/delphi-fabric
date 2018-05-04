const helper = require('./helper.js');
const logger = require('../common/nodejs/logger').new('invoke-chaincode');
const eventHelper = require('../common/nodejs/eventHub');
const {resultWrapper}  = require('../common/nodejs/chaincode');
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
exports.invoke= (channel, richPeers, { chaincodeId, fcn, args }, client = channel._clientContext) => {
	logger.debug({ channelName: channel.getName(), peersSize: richPeers.length, chaincodeId, fcn, args });
	const { eventWaitTime } = channel;
	const txId = client.newTransactionID();

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: richPeers //optional: use channel.getPeers() as default
	};
	return channel.sendTransactionProposal(request).
		then(helper.chaincodeProposalAdapter('invoke')).
		then(({ nextRequest, errCounter }) => {
			const { proposalResponses } = nextRequest;

			if (errCounter >0) {
				return Promise.reject({ proposalResponses });
			}
			const promises = [];

			for (let peer of richPeers) {
				const eventhub = helper.bindEventHub(peer, client);
				const txPromise = eventHelper.txEventPromise(eventhub, { txId, eventWaitTime }, ({ tx, code }) => {
					return { valid: code === 'VALID', interrupt: true };
				});
				promises.push(txPromise);
			}

			return channel.sendTransaction(nextRequest).then((/*{ status: 'SUCCESS' }*/) => {
				return Promise.all(promises).then((txEventResponses) =>
					resultWrapper(txEventResponses,{proposalResponses})
				);
			});
		});

};


exports.query= (channel, peers, { chaincodeId, fcn, args }, client = channel._clientContext) => {
	logger.debug('query',{ channelName: channel.getName(), peersSize: peers.length, chaincodeId, fcn, args });
	const txId = client.newTransactionID();

	const request = {
		chaincodeId,
		fcn,
		args,
		txId,
		targets: peers //optional: use channel.getPeers() as default
	};

	return channel.queryByChaincode(request).then(results=>results.map(e=>e.toString()));

};
