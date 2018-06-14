// NOTE Invoke action cannot be performed on peer without chaincode installed(no matter whether chaincode has been instantiated on this peer): Error: cannot retrieve package for chaincode adminChaincode/v0, error open /var/hyperledger/production/chaincodes/adminChaincode.v0: no such file or directory

const {invoke} = require('./chaincodeHelper');
const {reducer} = require('../common/nodejs/chaincode');
const helper = require('./helper');

const logger = require('../common/nodejs/logger').new('testInvoke');
const chaincodeId = 'adminChaincode';
const fcn = '';
const args = [];
const peerIndexes = [0];
const orgName = 'PM.Delphi.com';
const channelName = 'allchannel';

const peers = helper.newPeers(peerIndexes, orgName);

const task = async () => {
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	const {txEventResponses, proposalResponses} = await invoke(channel, peers, {chaincodeId, fcn, args});
	const result = reducer({txEventResponses, proposalResponses});
	logger.info(result);
};
task();

