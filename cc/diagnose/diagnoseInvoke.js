const {invoke, looper} = require('../../app/invokeHelper');
const logger = require('../../common/nodejs/logger').new('invoke:diagnose', true);
const chaincodeId = 'master';
exports.put = async (peers, clientPeerOrg, key, value) => {
	const fcn = 'put';
	const args = [key, JSON.stringify(value)];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get';
	const args = [key];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};


