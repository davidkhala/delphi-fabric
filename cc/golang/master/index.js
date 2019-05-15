const helper = require('../../../app/helper');
const logger = require('../../../common/nodejs/logger').new('invoke:master', true);
const {increase, putPrivate} = require('./masterInvoke');
const install = require('./masterInstall');
const flow = async () => {
	await install.task();
	const peers = [helper.newPeer(0, 'icdd'), helper.newPeer(0, 'ASTRI.org')];
	const clientOrg = 'ASTRI.org';

	await increase(peers, clientOrg);

};
flow();
