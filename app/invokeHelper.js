import * as helper from './helper';
import Transaction from '../common/nodejs/transaction';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const defaultLogger = consoleLogger('transaction helper');
export default class InvokeHelper {
	/**
	 *
	 * @param endorsingPeers
	 * @param clientOrg
	 * @param chaincodeId
	 * @param [channelName]
	 */
	constructor(endorsingPeers, clientOrg, chaincodeId, channelName = 'allchannel', logger = defaultLogger) {
		const user = helper.getOrgAdmin(clientOrg);
		const channel = helper.prepareChannel(channelName);

		const tx = new Transaction(endorsingPeers, user, channel, chaincodeId, logger);
		this._clientOrg = clientOrg;

		Object.assign(this, {tx, peers: endorsingPeers, logger});
	}

	async connect() {
		for (const peer of this.peers) {
			await peer.connect();
		}
	}

	async query({fcn, args, transientMap}) {
		await this.connect();
		this.logger.debug('query', 'client org', this._clientOrg);
		const {tx} = this;
		const result = await tx.evaluate({fcn, args, transientMap});
		result.queryResults = result.queryResults.map(entry => entry.toString());
		return result.queryResults;
	}

	async invoke({fcn, init, args, transientMap, nonce}, orderer = helper.newOrderers()[0], finalityRequired) {
		await this.connect();
		this.logger.debug('invoke', 'client org', this._clientOrg);
		const {tx} = this;
		await orderer.connect();

		return await tx.submit({fcn: init ? fcn : undefined, args, transientMap, init, nonce}, orderer, finalityRequired);
	}
}

