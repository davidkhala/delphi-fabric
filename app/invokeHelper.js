
import * as helper from './helper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import FabricGateway from '../common/nodejs/fabric-gateway/index.js';

const defaultLogger = consoleLogger('transaction helper');
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
	constructor(peer, clientOrg, chaincodeId, channelName, logger = defaultLogger) {
		const user = new UserBuilder(undefined, helper.getOrgAdmin(clientOrg));

		const gateway = new FabricGateway(peer, user);

		const tx = gateway.getContract(channelName, chaincodeId);

		Object.assign(this, {tx, gateway, logger});
	}

	connect() {
		this.gateway.connect();
	}

	async query({args, transientMap}) {
		await this.connect();
		const result = await this.tx.evaluate(args, transientMap);
		await this.disconnect();
		return result
	}

	/**
	 * 'Init' function is legacy
	 * @param args
	 * @param [transientMap]
	 * @param [finalityRequired]
	 * @returns {Promise<*>}
	 */
	async invoke({args, transientMap}, finalityRequired) {
		await this.connect();
		const {tx} = this;
		const result= await tx.submit(args, transientMap, undefined, !!finalityRequired);
		await this.disconnect()
		return result
	}

	disconnect() {
		this.gateway.disconnect();
	}
}

