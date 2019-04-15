const {invoke, query} = require('../../app/invokeHelper');
const logger = require('../../common/nodejs/logger').new('invoke:node diagnose', true);
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