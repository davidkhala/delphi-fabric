import * as invoke from '../../cc/golang/diagnose/diagnoseInvoke.js';
import fsExtra from 'fs-extra';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import path from 'path';
import {filedirname} from '@davidkhala/light/es6.mjs';
import * as helper from '../../app/helper.js';

filedirname(import.meta);
const logger = consoleLogger('value size');
const imgPath = path.resolve(__dirname, '8m.jpg');
describe('value size', () => {
	it('image as value', async () => {
		const imageBuffer = fsExtra.readFileSync(imgPath);
		const org1 = 'icdd';
		const org2 = 'astri.org';
		const peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
		const key = 'img';
		logger.info('put value:pic size', imageBuffer.length);
		await invoke.putRaw(peers, org1, key, imageBuffer);
	});
});


