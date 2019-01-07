const {invoke, query} = require('../../app/invokeHelper');
const logger = require('../../common/nodejs/logger').new('invoke:diagnose', true);
const chaincodeId = 'diagnose';
exports.put = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
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

exports.richQuery = async (peers, clientPeerOrg) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(['Time'], 1)];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.putEndorsement = async (peers, clientPeerOrg, key, orgs) => {
	const fcn = 'putEndorsement';
	const args = [key, ...orgs];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getEndorsement = async (peers, clientPeerOrg, key) => {
	const fcn = 'getEndorsement';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
