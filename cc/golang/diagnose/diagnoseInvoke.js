import {base64} from '@davidkhala/light/format.js';
import {queryBuilder} from '../../../common/nodejs/couchdb.js';
import * as helper from '../../../app/helper.js';
import InvokeHelper from '../../../app/invokeHelper.js';

const chaincodeId = 'diagnose';

export class DiagnoseInvoke {
	/**
	 *
	 * @param channelName
	 * @param clientOrg
	 * @param peer
	 */
	constructor(channelName = 'allchannel', clientOrg = 'icdd', peer = helper.newPeer(1, clientOrg)) {
		this.helper = new InvokeHelper(peer, clientOrg, chaincodeId, channelName);
	}

	async query(args, transientMap) {
		return this.helper.query({args, transientMap});
	}

	async invoke(args, transientMap) {
		return this.helper.invoke({args, transientMap}, true);
	}

	async panic() {
		return this.query(['panic']);
	}

	async list() {
		return this.query(['worldStates']);
	}

	async put(key, value) {
		return this.invoke(['put', key, JSON.stringify(value)]);
	}

	async putRaw(key, value) {
		return this.invoke(['putRaw', key, value]);
	}

	async getRaw(key) {
		return this.query(['getRaw', key]);
	}

	async get(key) {
		return this.query(['get', key]);
	}

	async whoami() {
		const queryResult = await this.query(['whoami']);
		const {MspID, CertificatePem} = JSON.parse(queryResult);
		return {MspID, CertificatePem: base64.decode(CertificatePem)};
	};

	async history(key) {
		const result = await this.query(['history', key]);
		return JSON.parse(result).map(modification => {
			const converted = Object.assign({}, modification);
			converted.Value = base64.decode(modification.Value);
			return converted;
		});
	}

	async cross(targetChaincode, fcn, args) {

		return this.invoke(
			['delegate', JSON.stringify({
				ChaincodeName: targetChaincode,
				Fcn: fcn,
				Args: Array.isArray(args) ? args : [],
				Channel: ''
			})]
		);
	}

	async richQuery() {
		const args = ['richQuery', queryBuilder(undefined, ['Time'], 1)];
		return this.query(args);
	}

	async putEndorsement(peers, orderer, key, mspids) {

		const tx = this.helper.classicTransaction(peers);
		for (const peer of peers) {
			await peer.connect();
		}
		let result;
		if (mspids) {
			result = await tx.submit({
				fcn: 'putEndorsement',
				args: [key, ...mspids]
			}, orderer);

		} else {
			result = await tx.submit({
				fcn: 'deleteEndorsement',
				args: [key]
			}, orderer);
		}
		for (const peer of peers) {
			await peer.disconnect();
		}
		return result;
	}

	async getEndorsement(key) {
		return this.query(['getEndorsement', key]);
	}

	async getPage(startKey = '', endKey = '', pageSize = '1', bookMark = '') {
		const args = ['listPage', startKey, endKey, pageSize.toString(), bookMark];
		return this.query(args);
	}

	async putBatch(map) {
		const args = ['putBatch', JSON.stringify(map)];
		return this.invoke(args);
	}

	async chaincodeID() {
		return this.query(['chaincodeId']);
	}

	async peerMSPID() {
		return this.query(['peerMSPID']);
	}

	async chaincodePing() {
		return this.query(['external']);
	}

	async getCertID() {
		return this.query(['getCertID']);
	}

	async getPrivate(transientMap) {
		return this.query(['getPrivate'], transientMap);
	}

	async putPrivate(transientMap) {
		return this.invoke(['putPrivate'], transientMap);
	}

	// TODO do hack and see behavior
	async putImplicit(transientMap, mspid) {
		const args = ['putImplicit'];
		if (mspid) {
			args.push(mspid);
		}
		return this.invoke(args, transientMap);
	};

	async getImplicit(transientMap, mspid) {
		const args = ['getImplicit'];
		if (mspid) {
			args.push(mspid);
		}
		return this.query(args, transientMap);
	}
}
