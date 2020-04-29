const install = require('./install');
const invoke = require('./invoke');
const helper = require('../../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('tokenCommon');
const flow2 = async () => {
	await install.task2();
	const org1 = 'astri.org';
	const org2 = 'icdd';

	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const token = await invoke.putPrivate(peers, org1, 'a', 'b');

	const value = await invoke.getPrivate(peers, org2, token);
	logger.debug({value});
};
const flow = async () => {
	await install.task();
	const org1 = 'astri.org';
	const org2 = 'icdd';

	const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const token = 'abc';
	await invoke.putToken(peers, org1, token);
	const Owner = 'david';
	const Manager = 'cityU';
	await invoke.moveToken(peers, org1, token, {Owner, Manager});
	try {
		await invoke.moveToken(peers, org2, token, {Owner, Manager});
	} catch (e) {
		logger.info(e);
	}

	const history = await invoke.tokenHistory(peers, org2, token);
	logger.info('history', history);
};
flow();
