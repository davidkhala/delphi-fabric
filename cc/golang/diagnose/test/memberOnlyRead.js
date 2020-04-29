const {putPrivate, getPrivate} = require('../diagnoseInvoke');
const helper = require('../../../../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:memberOnlyRead');
const task = async () => {
	const org1 = 'astri.org';
	const org2 = 'icdd';
	const p1 = helper.newPeer(0, org1);
	const key = 'a';
	const dataSet = {[key]: 'b'};
	await putPrivate([p1], org1, dataSet);
	try {
		await getPrivate([p1], org2, key);
		logger.error('error should be expected');
	} catch (e) {
		logger.info('error appears as expected');
	}

};
task();