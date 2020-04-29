const install = require('./install');
const {touch} = require('./invoke');
const chaincodeId = 'nodeStress';
const helper = require('../../../app/helper');
const task = async () => {
	await install.task();
	const org1 = 'astri.org';
	const peers = helper.newPeers([0], org1);
	await touch(peers, org1);
};
task();
