const {invoke} = require('./invokeHelper');
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
exports.putDouble = async (peers, clientPeerOrg) => {
	const fcn = 'put2';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.get = async (peers, clientPeerOrg, key) => {
	const fcn = 'get2';
	const args = [key];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.flow = async () => {
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeers([0], org1)[0], helper.newPeers([0], org2)[0]];
	const clientOrg = helper.randomOrg('peer');
	const {responses} = await exports.putDouble(peers, clientOrg);
	const key = responses[0];
	const value = await exports.get(peers, clientOrg, key);
	logger.debug({value});
};
