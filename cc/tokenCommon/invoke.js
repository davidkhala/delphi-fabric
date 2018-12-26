const {invoke} = require('../../app/invokeHelper');
const chaincodeId = 'sideChain2';
exports.putPrivate = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'putPrivate';
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, [key, value]);
	return result[0];
};
exports.getPrivate = async (peers, clientPeerOrg, token) => {
	const fcn = 'getPrivate';
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, [token]);
	return result[0];
};