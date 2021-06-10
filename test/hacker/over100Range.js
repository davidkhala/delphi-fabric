const helper = require('../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('hack: >100 history[range]');
const {putBatch, GetStateByRange} = require('../../cc/golang/diagnose/diagnoseInvoke');
const install = require('../../cc/golang/diagnose');
const putBatchTest = async (size) => {
	const map = {};
	for (let i = 0; i < size; i++) {
		const iStr = `${i}`;
		const padded = iStr.padStart(3, '0');
		map[`key_${padded}`] = `${i}`;
	}
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	await putBatch(peers, org1, map);
};
const GetStateByRangeTest = async (startKey, endKey) => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	const result = await GetStateByRange(peers, org1, startKey, endKey);
	logger.debug('GetStateByRange', result);
};
const taskOverRange = async (times) => {

	await putBatchTest(times);
	try {
		await GetStateByRangeTest();
		if (times > 100) {
			logger.error('failure expected');
			process.exit(1);
		}
	} catch (e) {
		logger.warn('failure expected');
		logger.warn(e);
	}
};
const task = async () => {

	await install.task();
	await taskOverRange();
};

task(200);
