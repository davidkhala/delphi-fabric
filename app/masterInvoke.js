const {invoke, looper} = require('./invokeHelper');
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('invoke:master', true);
const chaincodeId = 'master';
exports.putPrivate = async (peers, clientPeerOrg) => {
	const fcn = 'put';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.getPrivate = async (peers, clientPeerOrg) => {
	const fcn = 'get';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.increase = async (peers, clientPeerOrg) => {
	const fcn = 'increase';
	const args = [];
	const result = await invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
	return result[0];
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get2';
	const args = [key];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};


