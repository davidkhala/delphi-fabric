const helper = require('../../app/helper');
const logger = helper.getLogger('hack: >100 history');
const {GetCompositeStateByRange, putCompositeBatch} = require('../../cc/golang/diagnose/diagnoseInvoke');
const install = require('../../cc/golang/diagnose/diagnoseInstall');
const putCompositeBatchTest = async (objectType, size) => {
	const map = {};
	for (let i = 0; i < size; i++) {
		const iStr = `${i}`;
		const padded = iStr.padStart(3, '0');
		map[`key_${padded}`] = `${i}`;
	}
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	await putCompositeBatch(peers, org1, objectType, map);
};
const GetCompositeStateByRangeTest = async (objectType) => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);

	await GetCompositeStateByRange(peers, org1, objectType);
};
const taskOverRangeComposite = async (times) => {
	const objectType = 'over';
	await putCompositeBatchTest(objectType, times);
	try {
		await GetCompositeStateByRangeTest(objectType);
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
	await taskOverRangeComposite(101);

};

task();
