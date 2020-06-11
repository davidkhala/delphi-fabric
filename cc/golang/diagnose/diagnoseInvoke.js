const {invoke, query} = require('../../../app/invokeHelper');
const {base64} = require('khala-nodeutils/format');
const chaincodeId = 'diagnose';
exports.put = async (peers, clientOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.putRaw = async (peers, clientOrg, key, value) => {
	const fcn = 'putRaw';
	const args = [key, value];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.getRaw = async (peers, clientOrg, key) => {
	const fcn = 'getRaw';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.get = async (peers, clientOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.whoami = async (peers, clientOrg) => {
	const queryResult = await query(peers, clientOrg, chaincodeId, {fcn: 'whoami'});
	return queryResult.map(json => {
		const {MspID, CertificatePem} = JSON.parse(json);
		return {MspID, CertificatePem: base64.decode(CertificatePem)};
	});
};
exports.history = async (peers, clientOrg, key) => {
	const results = await query(peers, clientOrg, chaincodeId, {
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
exports.cross = async (peers, clientOrg, targetChaincode, fcn, args) => {

	return invoke(peers, clientOrg, chaincodeId, {
		fcn: 'delegate', args: [JSON.stringify({
			ChaincodeName: targetChaincode,
			Fcn: fcn,
			Args: Array.isArray(args) ? args : [],
			Channel: ''
		})]
	});
};

const {queryBuilder} = require('../../../common/nodejs/couchdb');

exports.richQuery = async (peers, clientOrg, selector) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(selector, ['Time'], 1)];
	return query(peers, clientOrg, chaincodeId, {
		fcn, args
	});
};
exports.putEndorsement = async (peers, clientOrg, key, mspids) => {
	if (mspids) {
		const fcn = 'putEndorsement';
		const args = [key, ...mspids];
		return invoke(peers, clientOrg, chaincodeId, {fcn, args});
	} else {
		const fcn = 'deleteEndorsement';
		const args = [key];
		return invoke(peers, clientOrg, chaincodeId, {fcn, args});
	}

};
exports.getEndorsement = async (peers, clientOrg, key) => {
	const fcn = 'getEndorsement';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};

exports.panic = async (peers, clientOrg) => {
	const fcn = 'panic';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.getPage = async (peers, clientOrg, startKey = '', endKey = '', pageSize = '1', bookMark = '') => {
	const fcn = 'listPage';
	const args = [startKey, endKey, pageSize.toString(), bookMark];
	return query(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.list = async (peers, clientOrg) => {
	const fcn = 'worldStates';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.putBatch = async (peers, clientOrg, map) => {
	const fcn = 'putBatch';
	const args = [JSON.stringify(map)];
	return invoke(peers, clientOrg, chaincodeId, {fcn, args});
};
exports.chaincodeID = async (peers, clientOrg) => {
	const fcn = 'chaincodeId';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.getCertID = async (peers, clientOrg) => {
	const fcn = 'getCertID';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
exports.readWritePrivate = async (peers, clientOrg, transientMap) => {
	const fcn = 'readWritePrivate';
	return invoke(peers, clientOrg, chaincodeId, {fcn, transientMap});
};
exports.getPrivate = async (peers, clientOrg, transientMap) => {
	const fcn = 'getPrivate';
	return query(peers, clientOrg, chaincodeId, {fcn, transientMap});
};

exports.putPrivate = async (peers, clientOrg, transientMap) => {
	const fcn = 'putPrivate';
	return invoke(peers, clientOrg, chaincodeId, {fcn, transientMap});
};
exports.putImplicit = async (peers, clientOrg, transientMap, mspid) => {
	const fcn = 'putImplicit';
	if (!mspid) {
		const {organizations} = require('../../../config/orgs.json');
		mspid = organizations[clientOrg].mspid;
	}
	return invoke(peers, clientOrg, chaincodeId, {fcn, args: [mspid], transientMap});
};
exports.getImplicit = async (peers, clientOrg, transientMap, mspid) => {
	const fcn = 'getImplicit';
	if (!mspid) {
		const {organizations} = require('../../../config/orgs.json');
		mspid = organizations[clientOrg].mspid;
	}
	return query(peers, clientOrg, chaincodeId, {fcn, args: [mspid], transientMap});
};
exports.peerMSPID = async (peers, clientOrg) => {
	const fcn = 'peerMSPID';
	return query(peers, clientOrg, chaincodeId, {fcn});
};
