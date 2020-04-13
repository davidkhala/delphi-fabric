const install = require('../../cc/golang/diagnose/diagnoseInstall');
const invoke = require('../../cc/golang/diagnose/diagnoseInvoke');
const fsExtra = require('fs-extra');
const {consoleLogger} = require('khala-logger/log4js');
const testHelper = require('../testHelper');
const logger = consoleLogger('test:keyValueSize');
const path = require('path');
const imgPath = path.resolve(__dirname, '8m.jpg');
const helper = require('../../app/helper');
const taskKeySize = async () => {
	await install.task();//
	const imageBuffer = fsExtra.readFileSync(imgPath);
	const org1 = 'icdd';
	const org2 = 'astri.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const key = 'img';
	logger.info('put value:pic size', imageBuffer.length);
	await invoke.putRaw(peers, org1, key, imageBuffer);
	const result = await invoke.getRaw(peers, org1, key);
	logger.info('get value:pic size', result[0].length);
	testHelper.writeArtifacts(result[0], `${new Date().getTime()}.jpg`);
};
taskKeySize();
