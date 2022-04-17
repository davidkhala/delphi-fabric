import {base64} from '@davidkhala/light/format.js';
import {queryBuilder} from '../../../common/nodejs/couchdb.js';
import * as helper from '../../../app/helper.js';
import InvokeHelper from '../../../app/invokeHelper.js';

const chaincodeId = 'diagnose';
const {channelName = 'allchannel'} = process.env;
const clientOrg = 'icdd';
// TODO hack
const peer = helper.newPeer(0, clientOrg);

const plainQuery = (arg) => async () => {
	return query({args: [arg]});
};

export const invoke = new InvokeHelper(peer, clientOrg, chaincodeId, channelName).invoke;
const query = new InvokeHelper(peer, clientOrg, chaincodeId, channelName).query;
export const put = async (key, value) => {
	const args = ['put', key, JSON.stringify(value)];
	return invoke({args});
};
export const putRaw = async (key, value) => {
	const args = ['putRaw', key, value];
	return invoke({args});
};
export const getRaw = async (key) => {
	const args = ['getRaw', key];
	return query({args});
};
export const get = async (key) => {
	const args = ['get', key];
	return query({args});
};
export const whoami = async () => {
	const queryResult = await query({args: ['whoami']});
	const {MspID, CertificatePem} = JSON.parse(queryResult);
	return {MspID, CertificatePem: base64.decode(CertificatePem)};
};
export const history = async (key) => {
	const result = await query({
		args: ['history', key]
	});
	return JSON.parse(result).map(modification => {
		const converted = Object.assign({}, modification);
		converted.Value = base64.decode(modification.Value);
		return converted;
	});
};
export const cross = async (targetChaincode, fcn, args) => {

	return invoke({
		args: ['delegate', JSON.stringify({
			ChaincodeName: targetChaincode,
			Fcn: fcn,
			Args: Array.isArray(args) ? args : [],
			Channel: ''
		})]
	});
};

export const richQuery = async () => {
	const args = ['richQuery', queryBuilder(undefined, ['Time'], 1)];
	return query({args});
};
export const putEndorsement = async (key, mspids) => {
	if (mspids) {
		const args = ['putEndorsement', key, ...mspids];
		return invoke({args});
	} else {
		const args = ['deleteEndorsement', key];
		return invoke({args});
	}

};
export const getEndorsement = async (key) => {
	const args = ['getEndorsement', key];
	return query({args});
};

export const panic = plainQuery('panic');
export const getPage = async (startKey = '', endKey = '', pageSize = '1', bookMark = '') => {
	const args = ['listPage', startKey, endKey, pageSize.toString(), bookMark];
	return query({args});
};
export const list = plainQuery('worldStates');
export const putBatch = async (map) => {
	const args = ['putBatch', JSON.stringify(map)];
	return invoke({args});
};
export const chaincodeID = plainQuery('chaincodeId');
export const getCertID = plainQuery('getCertID');
export const readWritePrivate = async (transientMap) => {
	return invoke({args: ['readWritePrivate'], transientMap});
};
export const getPrivate = async (transientMap) => {
	return query({args: ['getPrivate'], transientMap});
};

export const putPrivate = async (transientMap) => {
	return invoke({args: ['putPrivate'], transientMap});
};
// TODO do hack and see behavior
export const putImplicit = async (transientMap) => {
	return invoke({args: ['putImplicit'], transientMap});
};
export const getImplicit = async (transientMap) => {
	return query({args: ['getImplicit'], transientMap});
};
export const peerMSPID = plainQuery('peerMSPID');

export const chaincodePing = plainQuery('external');