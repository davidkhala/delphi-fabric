import assert from 'assert'
import Path from 'path'
import {execSync} from '@davidkhala/light/devOps.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {filedirname} from '@davidkhala/light/es6.mjs'
import {newHSMCryptoSuite} from '../common/nodejs/hsm.js';
import {projectResolve} from '../app/helper.js';
filedirname(import.meta)

const logger = consoleLogger('test:hsm');
describe('HSM', () => {
	process.env.SOFTHSM2_CONF = projectResolve('config', 'softhsm2.conf');
	before(() => {
		execSync(Path.resolve(__dirname, 'hsm.sh'));
	});
	it('generate ephemeral ECDSA key pair, sign, and verify', async () => {
		const slot = 0;
		const pin = 'fabric';
		const cryptoSuite = newHSMCryptoSuite({slot, pin});
		const message = Buffer.from('hello');
		const key = cryptoSuite.generateEphemeralKey({algorithm: 'ECDSA'});
		const sig = cryptoSuite.sign(key, message, null);
		const verifyResult = cryptoSuite.verify(key, sig, message);
		assert.ok(verifyResult, 'ECDSATask:verifyResult')
	});
});
