const {invoke,query} = require('../../app/invokeHelper');
const chaincodeId = 'playground';
exports.put = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'put';
	const args = [key, value];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.history = async (peers, clientPeerOrg, key) => {
	const fcn = 'history';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.list = async (peers, clientPeerOrg) => {
	const fcn = 'list';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.compositeKey = async (peers, clientPeerOrg,objectType, key) => {
	const fcn = 'createComposite';
	const args = [objectType, key];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};