const chaincodeId = 'diagnose';
const install = require('../../cc/golang/diagnose/diagnoseInstall');
const invoke = require('../../cc/golang/diagnose/diagnoseInvoke');
const {nodeUtil} = require('../../common/nodejs/helper');
const {fsExtra} = nodeUtil.helper();
const logger = nodeUtil.devLogger('test:keyValueSize');
const path = require('path');
const imgPath = path.resolve(__dirname, '8m.jpg');
const outImgPath = path.resolve(__dirname, `${new Date().getTime()}.jpg`);
const helper = require('../../app/helper');
const taskKeySize = async () => {
	// await install.task();//
	const imageBuffer = fsExtra.readFileSync(imgPath);
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const key = 'img';
	logger.info('put value:pic size', imageBuffer.length);
	await invoke.putRaw(peers, org1, key, imageBuffer);
	const result = await invoke.getRaw(peers, org1, key);
	logger.info('get value:pic size', result[0].length);
	fsExtra.outputFileSync(outImgPath, result[0]);
};
taskKeySize();
