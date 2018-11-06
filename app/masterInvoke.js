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

const flow = async () => {
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeers([0], org1)[0], helper.newPeers([0], org2)[0]];
	const clientOrg = helper.randomOrg('peer');
	try {
		await looper(undefined, exports.increase, peers, clientOrg);
	} catch (e) {
		logger.error(e);
	}


};
flow();
