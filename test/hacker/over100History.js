const helper = require('../../app/helper');
const logger = helper.getLogger('hack: >100 history');
const {putRaw, history} = require('../../cc/golang/diagnose/diagnoseInvoke');
const install = require('../../cc/golang/diagnose/diagnoseInstall');

const taskRepeat = async (times) => {

	const peerOrg = 'icdd';
	const clientOrg = peerOrg;
	const peers = helper.newPeers([0], peerOrg);
	await install.task();
	const key = 'key';
	for (let i = 0; i < times; i++) {
		await putRaw(peers, clientOrg, key, 'a');
	}
	try {
		const historyRecords = await history(peers, clientOrg, key);
		if (times > 100) {
			logger.error('failure expected');
			process.exit(1);
		}
		logger.info('history', historyRecords[0].length);

	} catch (e) {
		logger.warn('failure expected');
		logger.warn(e);
	}

};

taskRepeat(101);
