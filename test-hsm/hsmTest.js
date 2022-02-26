import HSM from '../common/nodejs/hsm.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {projectResolve} from '../app/helper.js';
const logger = consoleLogger('test:hsm');
describe('HSM', () => {
	process.env.SOFTHSM2_CONF = projectResolve('config', 'softhsm2.conf');
	it('generate ephemeral ECDSA key pair, sign, and verify', async () => {
		const slot = 0;
		const pin = 'fabric';
		const cryptoSuite = HSM.newHSMCryptoSuite({slot, pin});
		const message = Buffer.from('hello');
		const key = cryptoSuite.generateEphemeralKey({algorithm: 'ECDSA'});
		const sig = cryptoSuite.sign(key, message, null);
		const verifyResult = cryptoSuite.verify(key, sig, message);
		logger.info('ECDSATask:verifyResult', verifyResult);
	});
});
