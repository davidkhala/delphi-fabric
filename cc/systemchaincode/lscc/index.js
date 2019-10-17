const helper = require('../../../app/helper');
const logger = helper.getLogger('invoke:lscc');
const {ChaincodeExists} = require('./invoke');

const ChaincodeExistsTest = async (peers, clientOrg, channelName) => {
	const channel = channelName;
	const chaincode = 'diagnose';
	const result = await ChaincodeExists(peers, clientOrg, {channel, chaincode});
	logger.debug({channel, chaincode}, result);
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
		default:
	}
};
task();