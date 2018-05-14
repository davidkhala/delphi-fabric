const helper = require('./helper.js');
const logger = require('../common/nodejs/logger').new('Join-Channel');
const EventHubUtil = require('../common/nodejs/eventHub');

//we could let peers from different org to join channel in 1 request
exports.joinChannel = async (channel, peers, client) => {
	logger.debug({channelName: channel.getName(), peersSize: peers.length});

	if (client) {
		channel._clientContext = client;
	} else {
		client = channel._clientContext;
	}
	const genesis_block = await channel.getGenesisBlock({txId: client.newTransactionID()});
	logger.debug('signature identity', client.getUserContext().getName());
	const request = {
		targets: peers,
		txId: client.newTransactionID(),
		block: genesis_block
	};

	const promises = [];//NOTE listener should be set before channel.join
	const eventHubs = [];
	for (const peer of peers) {
		const client = await peer.peerConfig.eventHub.clientPromise;

		const eventHub = helper.bindEventHub(peer, client);
		const validator = ({block}) => {
			logger.debug('new block event arrived', eventHub._ep, block);
			// in real-world situations, a peer may have more than one channels so
			// we must check that this block came from the channel we asked the peer to join
			if (block.data.data.length === 1) {
				// Config block must only contain one transaction
				if (block.data.data[0].payload.header.channel_header.channel_id
					=== channel.getName()) {
					return {valid: true, interrupt: true};
				}
			}
			return {valid: false, interrupt: false};
		};
		let eventID;
		const promise = new Promise((resolve, reject) => {
			const onSucc = (_) => resolve(_);
			const onErr = (e) => reject(e);
			eventID = EventHubUtil.blockEvent(eventHub, validator, onSucc, onErr);
		});
		promises.push(promise);
		eventHubs.push({eventHub, eventID});
	}

	const data = await channel.joinChannel(request);
	logger.debug({data});
	//FIXME bug design in fabric: error message occurred in Promise.resolve/then
	const joinedBefore = [];
	const joinedBeforeSymptom = '(status: 500, message: Cannot create ledger from genesis block, due to LedgerID already exists)';
	for (const dataEntry of data) {
		if (dataEntry instanceof Error) {
			//swallow 'joined before' error
			if (dataEntry.toString().includes(joinedBeforeSymptom)) {
				logger.warn('swallow when existence');
				joinedBefore.push(dataEntry);
			} else {
				throw data;
			}
		}
	}
	if (joinedBefore.length === data.length) {
		//when all joined before
		logger.info('all joined before');
		eventHubs.forEach(({eventHub,eventID}) => {
			eventHub.unregisterBlockEvent(eventID);
			eventHub.disconnect();
		});
		return data;
	} else {
		return Promise.all(promises);
	}
};
