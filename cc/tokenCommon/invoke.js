const {invoke} = require('../../app/invokeHelper');

exports.putPrivate = async (peers, clientPeerOrg, key, value) => {
	const chaincodeId = 'sideChain2';
	const fcn = 'putPrivate';
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, [key, value]);
	return result[0];
};
exports.getPrivate = async (peers, clientPeerOrg, token) => {
	const chaincodeId = 'sideChain2';
	const fcn = 'getPrivate';
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, [token]);
	return result[0];
};
exports.putToken = async (peers, clientPeerOrg, token) => {
	const chaincodeId = 'global';
	const fcn = 'putToken';
	await invoke(peers, clientPeerOrg, chaincodeId, fcn, [token, JSON.stringify({})]);
};
exports.moveToken = async (peers, clientPeerOrg, token, {Owner, Manager}) => {

	const transferReq = {
		Owner,
		Manager
	};
	const chaincodeId = 'global';
	const fcn = 'moveToken';
	await invoke(peers, clientPeerOrg, chaincodeId, fcn, [token, JSON.stringify(transferReq)]);
};
exports.tokenHistory = async (peers, clientPeerOrg, token) => {
	const chaincodeId = 'global';
	const fcn = 'tokenHistory';
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, [token]);
	return result[0];
};