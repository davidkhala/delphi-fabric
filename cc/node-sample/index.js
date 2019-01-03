const install = require('./install');
const diagnoseInstall = require('../diagnose/diagnoseInstall');
const {cross} = require('../diagnose/diagnoseInvoke');
const cc = 'nodeSample';
const logger = require('../../common/nodejs/logger').new(`invoke:${cc}`, true);
const helper = require('../../app/helper');
const task = async () => {
	await install.task();
	await diagnoseInstall.task();
	const org1 = 'ASTRI.org';

	const peers = helper.newPeers([0], org1);
	const value = await cross(peers, org1, cc);
	logger.info('cross value', value);
};
task();