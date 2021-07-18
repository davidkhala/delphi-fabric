const helper = require('./helper');
const Transaction = require('../common/nodejs/transaction');

class InvokeHelper {
	constructor(endorsingPeers, clientOrg, chaincodeId, channelName = 'allchannel', {args, transientMap} = {}) {
		const user = helper.getOrgAdmin(clientOrg);
		const channel = helper.prepareChannel(channelName);
		this.logger = require('khala-logger/log4js').consoleLogger('transaction helper');
		this._clientOrg = clientOrg;
		const tx = new Transaction(endorsingPeers, user, channel, chaincodeId, this.logger);

		Object.assign(this, {tx, peers: endorsingPeers, args, transientMap});
	}

	async connect() {
		for (const peer of this.peers) {
			await peer.connect();
		}
	}

	async query(fcn) {
		await this.connect();
		this.logger.debug('query', 'client org', this._clientOrg);
		const {args, transientMap, tx} = this;
		const result = await tx.evaluate({fcn, args, transientMap});
		result.queryResults = result.queryResults.map(entry => entry.toString());
		return result.queryResults;
	}

	async invoke({fcn, init}, orderer = helper.newOrderers()[0]) {
		await this.connect();
		this.logger.debug('invoke', 'client org', this._clientOrg);
		const {tx, args, transientMap} = this;
		await orderer.connect();

		return await tx.submit({fcn: init ? fcn : undefined, args, transientMap, init}, orderer);
	}
}

module.exports = InvokeHelper;
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

