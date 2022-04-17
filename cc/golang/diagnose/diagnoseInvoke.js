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
	constructor(channelName = 'allchannel', clientOrg = 'icdd', peer = helper.newPeer(0, clientOrg)) {
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
		const args = ['put', key, JSON.stringify(value)];
		return this.invoke({args});
	}

	async putRaw(key, value) {
		const args = ['putRaw', key, value];
		return this.invoke({args});
	}

	async getRaw(key) {
		const args = ['getRaw', key];
		return this.query({args});
	}

	async get(key) {
		const args = ['get', key];
		return this.query({args});
	}

	async whoami() {
		const queryResult = await this.query({args: ['whoami']});
		const {MspID, CertificatePem} = JSON.parse(queryResult);
		return {MspID, CertificatePem: base64.decode(CertificatePem)};
	};

	async history(key) {
		const result = await this.query({
			args: ['history', key]
		});
		return JSON.parse(result).map(modification => {
			const converted = Object.assign({}, modification);
			converted.Value = base64.decode(modification.Value);
			return converted;
		});
	}

	async cross(targetChaincode, fcn, args) {

		return this.invoke({
			args: ['delegate', JSON.stringify({
				ChaincodeName: targetChaincode,
				Fcn: fcn,
				Args: Array.isArray(args) ? args : [],
				Channel: ''
			})]
		});
	}

	async richQuery() {
		const args = ['richQuery', queryBuilder(undefined, ['Time'], 1)];
		return this.query({args});
	}

	async putEndorsement(key, mspids) {
		if (mspids) {
			const args = ['putEndorsement', key, ...mspids];
			return this.invoke({args});
		} else {
			const args = ['deleteEndorsement', key];
			return this.invoke({args});
		}
	}

	async getEndorsement(key) {
		const args = ['getEndorsement', key];
		return this.query({args});
	}

	async getPage(startKey = '', endKey = '', pageSize = '1', bookMark = '') {
		const args = ['listPage', startKey, endKey, pageSize.toString(), bookMark];
		return this.query({args});
	}

	async putBatch(map) {
		const args = ['putBatch', JSON.stringify(map)];
		return this.invoke({args});
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
		return this.query({args: ['getPrivate'], transientMap});
	};

	async putPrivate(transientMap) {
		return this.invoke({args: ['putPrivate'], transientMap});
	};

	// TODO do hack and see behavior
	async putImplicit(transientMap, mspid) {
		const args = ['putImplicit'];
		if (mspid) {
			args.push(mspid);
		}
		return this.invoke({args, transientMap});
	};

	async getImplicit(transientMap, mspid) {
		const args = ['getImplicit'];
		if (mspid) {
			args.push(mspid);
		}
		return this.query({args, transientMap});
	}
}
