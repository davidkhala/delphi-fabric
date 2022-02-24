import InvokeHelper from '../../../app/invokeHelper';
import {base64} from '@davidkhala/nodeutils/format.js';
import {queryBuilder} from '../../../common/nodejs/couchdb';

import {importFrom} from '@davidkhala/light/es6.mjs';

const {organizations} = importFrom('../../../config/orgs.json');
const chaincodeId = 'diagnose';
const {channelName} = process.env;
const invoke = async (peers, clientOrg, {fcn, args, transientMap}) => {
	const invokeHelper = new InvokeHelper(peers, clientOrg, chaincodeId, channelName);
	return await invokeHelper.invoke({fcn, args, transientMap});
};
const query = async (peers, clientOrg, {fcn, args, transientMap}) => {
	const invokeHelper = new InvokeHelper(peers, clientOrg, chaincodeId, channelName);
	return await invokeHelper.query({fcn, args, transientMap});
};
export const put = async (peers, clientOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientOrg, {fcn, args});
};
export const putRaw = async (peers, clientOrg, key, value) => {
	const fcn = 'putRaw';
	const args = [key, value];
	return invoke(peers, clientOrg, {fcn, args});
};
export const getRaw = async (peers, clientOrg, key) => {
	const fcn = 'getRaw';
	const args = [key];
	return query(peers, clientOrg, {fcn, args});
};
export const get = async (peers, clientOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientOrg, {fcn, args});
};
export const whoami = async (peers, clientOrg) => {
	const queryResult = await query(peers, clientOrg, {fcn: 'whoami'});
	return queryResult.map(json => {
		const {MspID, CertificatePem} = JSON.parse(json);
		return {MspID, CertificatePem: base64.decode(CertificatePem)};
	});
};
export const history = async (peers, clientOrg, key) => {
	const results = await query(peers, clientOrg, {
		fcn: 'history', args: [key]
	});
	return results.map(result => {
		return JSON.parse(result).map(modification => {
			const converted = Object.assign({}, modification);
			converted.Value = base64.decode(modification.Value);
			return converted;
		});
	});
};
export const cross = async (peers, clientOrg, targetChaincode, fcn, args) => {

	return invoke(peers, clientOrg, {
		fcn: 'delegate', args: [JSON.stringify({
			ChaincodeName: targetChaincode,
			Fcn: fcn,
			Args: Array.isArray(args) ? args : [],
			Channel: ''
		})]
	});
};

export const richQuery = async (peers, clientOrg) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(undefined, ['Time'], 1)];
	return query(peers, clientOrg, {
		fcn, args
	});
};
export const putEndorsement = async (peers, clientOrg, key, mspids) => {
	if (mspids) {
		const fcn = 'putEndorsement';
		const args = [key, ...mspids];
		return invoke(peers, clientOrg, {fcn, args});
	} else {
		const fcn = 'deleteEndorsement';
		const args = [key];
		return invoke(peers, clientOrg, {fcn, args});
	}

};
export const getEndorsement = async (peers, clientOrg, key) => {
	const fcn = 'getEndorsement';
	const args = [key];
	return query(peers, clientOrg, {fcn, args});
};

export const panic = async (peers, clientOrg) => {
	const fcn = 'panic';
	return query(peers, clientOrg, {fcn});
};
export const getPage = async (peers, clientOrg, startKey = '', endKey = '', pageSize = '1', bookMark = '') => {
	const fcn = 'listPage';
	const args = [startKey, endKey, pageSize.toString(), bookMark];
	return query(peers, clientOrg, {fcn, args});
};
export const list = async (peers, clientOrg) => {
	const fcn = 'worldStates';
	return query(peers, clientOrg, {fcn});
};
export const putBatch = async (peers, clientOrg, map) => {
	const fcn = 'putBatch';
	const args = [JSON.stringify(map)];
	return invoke(peers, clientOrg, {fcn, args});
};
export const chaincodeID = async (peers, clientOrg) => {
	const fcn = 'chaincodeId';
	return query(peers, clientOrg, {fcn});
};
export const getCertID = async (peers, clientOrg) => {
	const fcn = 'getCertID';
	return query(peers, clientOrg, {fcn});
};
export const readWritePrivate = async (peers, clientOrg, transientMap) => {
	const fcn = 'readWritePrivate';
	return invoke(peers, clientOrg, {fcn, transientMap});
};
export const getPrivate = async (peers, clientOrg, transientMap) => {
	const fcn = 'getPrivate';
	return query(peers, clientOrg, {fcn, transientMap});
};

export const putPrivate = async (peers, clientOrg, transientMap) => {
	const fcn = 'putPrivate';
	return invoke(peers, clientOrg, {fcn, transientMap});
};
export const putImplicit = async (peers, clientOrg, transientMap, mspid) => {
	const fcn = 'putImplicit';
	if (!mspid) {
		mspid = organizations[clientOrg].mspid;
	}
	return invoke(peers, clientOrg, {fcn, args: [mspid], transientMap});
};
export const getImplicit = async (peers, clientOrg, transientMap, mspid) => {
	const fcn = 'getImplicit';
	if (!mspid) {
		mspid = organizations[clientOrg].mspid;
	}
	return query(peers, clientOrg, {fcn, args: [mspid], transientMap});
};
export const peerMSPID = async (peers, clientOrg) => {
	const fcn = 'peerMSPID';
	return query(peers, clientOrg, {fcn});
};
export const chaincodePing = async (peers, clientOrg) => {
	const fcn = 'external';
	return query(peers, clientOrg, {fcn});
};