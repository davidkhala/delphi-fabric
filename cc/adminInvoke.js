const {invoke} = require('../app/invokeHelper');
const helper = require('../app/helper');

const chaincodeId = 'adminChaincode';
const {queryBuilder} = require('../common/nodejs/couchdb');

exports.richQuery = async (peers, clientPeerOrg) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(['Time'], 1)];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.panic = async (peers, clientPeerOrg) => {
	const fcn = 'panic';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.set = async (peers, clientPeerOrg) => {
	const fcn = 'set';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};
exports.flow = async () => {
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeers([0], org1)[0], helper.newPeers([0], org2)[0]];
	//try to use another user
	const orgName = helper.randomOrg('peer');
	await exports.set(peers, orgName);
	await exports.set(peers, orgName);
	await exports.set(peers, orgName);
	await exports.set(peers, orgName);
	await exports.richQuery(peers, orgName);
};