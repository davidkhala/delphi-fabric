const {invoke, query} = require('../../app/invokeHelper');
const logger = require('../../common/nodejs/logger').new('invoke:diagnose', true);
const chaincodeId = 'diagnose';
exports.put = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.putRaw = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'putRaw';
	const args = [key, value];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getRaw = async (peers, clientPeerOrg, key) => {
	const fcn = 'getRaw';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.whoami = async (peers, clientPeerOrg) => {
	return query(peers, clientPeerOrg, chaincodeId, 'whoami', []);
};
exports.cross = async (peers, clientPeerOrg, targetChaincode, fcn, args) => {
	const Args = [JSON.stringify({
		ChaincodeName: targetChaincode,
		Fcn: fcn,
		Args: Array.isArray(args) ? args : [],
		Channel: ''
	})];

	return invoke(peers, clientPeerOrg, chaincodeId, 'delegate', Args);
};

const {queryBuilder} = require('../../common/nodejs/couchdb');

exports.richQuery = async (peers, clientPeerOrg, selector) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(selector, ['Time'], 1)];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.putEndorsement = async (peers, clientPeerOrg, key, mspids) => {
	const fcn = 'putEndorsement';
	const args = [key, ...mspids];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getEndorsement = async (peers, clientPeerOrg, key) => {
	const fcn = 'getEndorsement';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};

exports.panic = async (peers, clientPeerOrg) => {
	const fcn = 'panic';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getPage = async (peers, clientPeerOrg, startKey = '', endKey = '', pageSize = '1', bookMark = '') => {
	const fcn = 'listPage';
	const args = [startKey, endKey, pageSize.toString(), bookMark];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.list = async (peers, clientPeerOrg) => {
	const fcn = 'worldStates';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.putBatch = async (peers, clientPeerOrg, map) => {
	const fcn = 'putBatch';
	const args = [JSON.stringify(map)];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.chaincodeID = async (peers, clientPeerOrg) => {
	const fcn = 'chaincodeId';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getCertID = async (peers, clientPeerOrg) => {
	const fcn = 'getCertID';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};