const chaincodeID = 'lscc';
const {invoke, query} = require('../../../app/invokeHelper');
const {getActionSet} = require('../../../common/nodejs/systemChaincode');
exports.ChaincodeExists = async (peers, clientOrg, {channel, chaincode}) => {
	const fcn = 'ChaincodeExists';
	const args = [channel, chaincode];
	return query(peers, clientOrg, chaincodeID, fcn, args);
};