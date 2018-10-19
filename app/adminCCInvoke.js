const {invoke} = require('./chaincodeHelper');
const {reducer} = require('../common/nodejs/chaincode');
const helper = require('./helper');

const logger = require('../common/nodejs/logger').new('invoke admin');
const chaincodeId = 'adminChaincode';
const channelName = 'allchannel';
const {queryBuilder} = require('../common/nodejs/couchdb');

const task = async (peers, clientPeerOrg, fcn, args) => {
	//try to use another user
	logger.debug('client org', clientPeerOrg);
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	const transientMap = {testk: 'testValue'};
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args, transientMap});
	const result = reducer({txEventResponses, proposalResponses});
	logger.debug(result);
	return result;
};
exports.richQuery = async (peers, clientPeerOrg) => {
	const fcn = 'richQuery';
	const args = [queryBuilder(['Time'],1)];
	return task(peers, clientPeerOrg, fcn, args);
};
exports.panic = async (peers, clientPeerOrg) => {
	const fcn = 'panic';
	const args = [];
	return task(peers, clientPeerOrg, fcn, args);
};
exports.set = async (peers, clientPeerOrg) => {
	const fcn = 'set';
	const args = [];
	return task(peers, clientPeerOrg, fcn, args);
};
