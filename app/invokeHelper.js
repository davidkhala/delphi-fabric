import * as helper from './helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import FabricGateway from '../common/nodejs/fabric-gateway/index.js';

/**
 * use fabric-gateway to simplify
 */
export default class InvokeHelper {
	/**
	 *
	 * @param peer
	 * @param clientOrg
	 * @param chaincodeId
	 * @param channelName
	 * @param [logger]
	 */
	constructor(peer, clientOrg, chaincodeId, channelName, logger = consoleLogger(chaincodeId)) {
		const user = helper.getOrgAdmin(clientOrg);

		const userBuilder = new UserBuilder(undefined, user);

		const gateway = new FabricGateway(peer, userBuilder);

		const tx = gateway.getContract(channelName, chaincodeId);

		Object.assign(this, {tx, gateway, logger});
	}

	connect() {
		this.gateway.connect();
	}

	async query({args, transientMap}) {
		this.connect();
		const result = await this.tx.evaluate(args, transientMap);
		this.disconnect();
		return result;
	}

	/**
	 * You cannot use this to Init
	 * @param args
	 * @param [transientMap]
	 * @param [finalityRequired]
	 * @returns {Promise<*>}
	 */
	async invoke({args, transientMap}, finalityRequired) {
		this.connect();
		const {tx} = this;
		const result = await tx.submit(args, transientMap, undefined, !!finalityRequired);
		this.disconnect();
		return result;
	}

	disconnect() {
		this.gateway.disconnect();
	}
}

