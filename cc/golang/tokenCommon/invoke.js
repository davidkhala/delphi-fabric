const {invoke} = require('../../../app/invokeHelper');

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
