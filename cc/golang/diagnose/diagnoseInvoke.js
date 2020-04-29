const {invoke, query} = require('../../../app/invokeHelper');
const logger = require('../../../common/nodejs/logger').new('invoke:diagnose', true);
const {base64} = require('../../../common/nodejs/admin/helper').nodeUtil.format();
const chaincodeId = 'diagnose';
exports.put = async (peers, clientOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientOrg, chaincodeId, fcn, args);
};
exports.putRaw = async (peers, clientOrg, key, value) => {
	const fcn = 'putRaw';
	const args = [key, value];
	return invoke(peers, clientOrg, chaincodeId, fcn, args);
};
exports.getRaw = async (peers, clientOrg, key) => {
	const fcn = 'getRaw';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, fcn, args, undefined, true);
};
exports.get = async (peers, clientOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
exports.whoami = async (peers, clientOrg) => {
	return query(peers, clientOrg, chaincodeId, 'whoami', []);
};
exports.history = async (peers, clientOrg, key) => {
	const results = await query(peers, clientOrg, chaincodeId, 'history', [key]);
	return results.map(result => {
		return JSON.parse(result).map(modification => {
			const converted = Object.assign({}, modification);
			converted.Value = base64.decode(modification.Value);
			return converted;
		});
	});
};
exports.cross = async (peers, clientOrg, targetChaincode, fcn, args) => {
	const Args = [JSON.stringify({
		ChaincodeName: targetChaincode,
		Fcn: fcn,
		Args: Array.isArray(args) ? args : [],
		Channel: ''
	})];

	return invoke(peers, clientOrg, chaincodeId, 'delegate', Args);
};

const {queryBuilder} = require('../../../common/nodejs/couchdb');

exports.richQuery = async (peers, clientOrg, selector) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(selector, ['Time'], 1)];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
exports.putEndorsement = async (peers, clientOrg, key, mspids) => {
	const fcn = 'putEndorsement';
	const args = [key, ...mspids];
	return invoke(peers, clientOrg, chaincodeId, fcn, args);
};
exports.getEndorsement = async (peers, clientOrg, key) => {
	const fcn = 'getEndorsement';
	const args = [key];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};

exports.panic = async (peers, clientOrg) => {
	const fcn = 'panic';
	const args = [];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
exports.getPage = async (peers, clientOrg, startKey = '', endKey = '', pageSize = '1', bookMark = '') => {
	const fcn = 'listPage';
	const args = [startKey, endKey, pageSize.toString(), bookMark];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
exports.list = async (peers, clientOrg) => {
	const fcn = 'worldStates';
	const args = [];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
exports.putBatch = async (peers, clientOrg, map) => {
	const fcn = 'putBatch';
	const args = [JSON.stringify(map)];
	return invoke(peers, clientOrg, chaincodeId, fcn, args);
};
exports.chaincodeID = async (peers, clientOrg) => {
	const fcn = 'chaincodeId';
	const args = [];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
exports.getCertID = async (peers, clientOrg) => {
	const fcn = 'getCertID';
	const args = [];
	return query(peers, clientOrg, chaincodeId, fcn, args);
};
