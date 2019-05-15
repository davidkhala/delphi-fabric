const chaincodeId = 'diagnose';
const install = require('../../cc/golang/diagnose/diagnoseInstall');
const invoke = require('../../cc/golang/diagnose/diagnoseInvoke');
const {fsExtra} = require('../../common/nodejs/helper').nodeUtil.helper();
const path = require('path');
const imgPath = path.resolve(__dirname, 'value.png');
const helper = require('../../app/helper');
const taskKeySize = async () => {
	await install.task();
	const imageBuffer = fsExtra.readFileSync(imgPath);
	const org1 = 'icdd';
	const org2 = 'ASTRI.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	const key = 'img';
	await invoke.putRaw(peers, org1, key, imageBuffer);
	const result = await invoke.getRaw(peers, org1, key);
	fsExtra.outputFileSync(imgPath + (new Date().getTime()), result);
};
taskKeySize();
