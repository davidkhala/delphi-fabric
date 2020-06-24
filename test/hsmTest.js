const HSM = require('../hsm');
const logger = require('khala-logger/log4js').consoleLogger('test:hsm');
logger.info('libs', HSM.availablePKCSLibs);


describe('HSM', () => {
	const slot = 0;
	const pin = 'fabric';

	it('generate ephemeral ECDSA key pair, sign, and verify', async () => {
		const cryptoSuite = HSM.newHSMCryptoSuite({slot, pin});
		const message = Buffer.from('hello');
		const key = cryptoSuite.generateEphemeralKey({algorithm: 'ECDSA'});
		const sig = cryptoSuite.sign(key, message, null);
		// TODO (node:6461) [DEP0079] DeprecationWarning: Custom inspection function on Objects via .inspect() is deprecated
		const verifyResult = cryptoSuite.verify(key, sig, message);
		logger.info('ECDSATask:verifyResult', verifyResult);
	});
});
