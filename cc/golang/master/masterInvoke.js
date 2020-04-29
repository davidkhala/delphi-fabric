const {invoke,query} = require('../../../app/invokeHelper');
const chaincodeId = 'master';
exports.putPrivate = async (peers, clientPeerOrg) => {
	const fcn = 'putPrivate';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getPrivate = async (peers, clientPeerOrg) => {
	const fcn = 'getPrivate';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.increase = async (peers, clientPeerOrg) => {
	const fcn = 'increase';
	const args = [];
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
	return result[0];
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};

exports.getDecorations = async (peers, clientPeerOrg) => {
	const fcn = 'getDecorations';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};

exports.getBinding = async (peers, clientPeerOrg) => {
	const fcn = 'getBinding';
	const args = [];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};

