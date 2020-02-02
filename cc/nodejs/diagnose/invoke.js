const {invoke, query} = require('../../../app/invokeHelper');
const chaincodeId = 'nodeDiagnose';
exports.put = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'put';
	const args = [key, value];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return query(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.whoami = async (peers, clientPeerOrg) => {
	const fcn = 'whoami';
	return query(peers, clientPeerOrg, chaincodeId, fcn, []);
};
exports.transient = async (peers, clientPeerOrg, transientMap, key) => {
	const fcn = 'transient';
	return query(peers, clientPeerOrg, chaincodeId, fcn, [key], transientMap);
};
exports.worldStates = async (peers, clientPeerOrg) => {
	const fcn = 'worldStates';
	return query(peers, clientPeerOrg, chaincodeId, fcn, []);
};
exports.putBatch = async (peers, clientPeerOrg, batch) => {
	const fcn = 'putBatch';
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, [JSON.stringify(batch)]);
};
exports.history = async (peers, clientPeerOrg, key) => {
	const fcn = 'history';
	return query(peers, clientPeerOrg, chaincodeId, fcn, [key]);
};