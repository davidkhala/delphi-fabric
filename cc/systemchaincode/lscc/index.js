const helper = require('../../../app/helper');
const logger = helper.getLogger('invoke:lscc');

const {query} = require('../../../app/invokeHelper');
const {ChaincodeExists, GetChaincodeData, GetDeploymentSpec} = require('../../../common/nodejs/systemChaincode');
const ChaincodeExistsTest = async (peers, clientOrg, channelName) => {
	const chaincode = 'diagnose';

	const {chaincodeId, args, fcn} = ChaincodeExists(channelName, chaincode);
	const result = await query(peers, clientOrg, chaincodeId, fcn, args);
	logger.debug({channelName, chaincode}, result);
};
const GetChaincodeDataTest = async (peers, clientOrg, channelName) => {
	const chaincode = 'diagnose';

	const args = ['GetChaincodeData', channelName, chaincode];
	const fcn = 'lscc';
	const result = await query(peers, clientOrg, chaincode, fcn, args);
	logger.debug({channelName, chaincode}, result);
};
const GetDeploymentSpecTest = async (peers, clientOrg, channelName) => {
	const chaincode = 'diagnose';

	const args = ['GetDeploymentSpec', channelName, chaincode];
	const fcn = 'lscc';
	const result = await query(peers, clientOrg, chaincode, fcn, args);
	logger.debug({channelName, chaincode}, result);
};
const task = async (taskID = parseInt(process.env.taskID)) => {
	const peers = helper.newPeers([0], 'icdd');
	const clientOrg = 'icdd';
	switch (taskID) {
		case 1:
			await require('../../golang/diagnose/diagnoseInstall').task(undefined, 1);
			break;
		case 2:
			await require('../../golang/diagnose/diagnoseInstall').task('allchannel', 2);
			break;
		case 3:
			await ChaincodeExistsTest(peers, clientOrg, 'allchannel');
			break;
		case 4:
			await ChaincodeExistsTest(peers, clientOrg, 'extrachannel');
			break;
		case 5:
			await GetChaincodeDataTest(peers, clientOrg, 'allchannel');
			break;
		case 6:
			await GetDeploymentSpecTest(peers, clientOrg, 'allchannel');
			break;
		default:
	}
};
task();
