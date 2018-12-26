const helper = require('../../app/helper');
const logger = require('../../common/nodejs/logger').new('invoke:master', true);
const {increase, putPrivate, getBinding, getDecorations} = require('./masterInvoke');
const install = require('./masterInstall');
const flow = async () => {
	await install.task();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const clientOrg = org2;

	await putPrivate(peers, clientOrg);
	const binding = await getBinding(peers, clientOrg);
	logger.info('binding', binding);
	const decors = await getDecorations(peers, clientOrg);
	logger.info('decors', decors);
};
flow();