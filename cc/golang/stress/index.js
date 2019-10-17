const {touch} = require('./stressInvoke');

const helper = require('../../../app/helper');

const install = require('./stressInstall');
const task = async (taskID = parseInt(process.env.taskID)) => {
	let peers = helper.newPeers([0], 'icdd');
	let clientOrg = 'astri.org';
	switch (taskID) {
		case 1:
			await touch(peers, clientOrg);
			break;
		default:
			await install.task();
	}
};
task();
