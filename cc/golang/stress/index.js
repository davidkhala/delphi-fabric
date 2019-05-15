const {touch} = require('./stressInvoke');

const helper = require('../../../app/helper');

const install = require('./stressInstall');
const flow = async () => {
	await install.task();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const clientOrg = org2;
	await touch(helper.newPeers([0], org1), clientOrg);
};
flow();
