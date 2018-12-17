const {get, put} = require('./diagnoseInvoke');
const logger = require('../../common/nodejs/logger').new('invoke:diagnose', true);
const helper = require('../../app/helper');

const flow = async () => {
	await require('./diagnoseInstall');
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	const peers = [helper.newPeers([0], org1)[0], helper.newPeers([0], org2)[0]];
	const clientOrg = org2;
	const key = 'a';
	await put(peers, clientOrg, key, 'b');
	const gotValue = await get(peers, clientOrg, key);
	logger.debug('got value', gotValue);
};
flow();