const install = require('./install');
const invoke = require('./invoke');
const helper = require('../../app/helper');
const logger = require('../../common/nodejs/logger').new('tokenCommon', true);
const flow = async () => {
	await install.task();
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';

	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const token = await invoke.putPrivate(peers, org1, 'a', 'b');

	const value = await invoke.getPrivate(peers, org2, token);
	logger.debug({value});
};
flow();