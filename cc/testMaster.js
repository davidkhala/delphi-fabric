const {looper} = require('../app/invokeHelper');
const helper = require('../app/helper');
const logger = require('../common/nodejs/logger').new('invoke:master', true);
const {increase, putPrivate} = require('./masterInvoke');
const flow = async () => {
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeers([0], org1)[0], helper.newPeers([0], org2)[0]];
	const clientOrg = org2;

	await putPrivate(peers, clientOrg);
	// try {
	// 	await looper(undefined, increase, peers, clientOrg);
	// } catch (e) {
	// 	logger.error(e);
	// }
};
flow();