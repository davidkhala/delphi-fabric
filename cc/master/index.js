const helper = require('../../app/helper');
const logger = require('../../common/nodejs/logger').new('invoke:master', true);
const {increase, putPrivate} = require('./masterInvoke');
const install = require('./masterInstall');
const flow = async () => {
	await install.task();
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const clientOrg = org2;

	await putPrivate(peers, clientOrg);

};
flow();