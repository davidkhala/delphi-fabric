const {invoke} = require('../../../app/invokeHelper');
const chaincodeId = 'mainChain';
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get';
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, [key]);
};
exports.put = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'put';
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, [key, value]);
};