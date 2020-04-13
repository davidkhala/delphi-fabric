const caCryptoGen = require('../common/nodejs/ca-crypto-gen');
const {ECDSA_Key} = require('../common/nodejs/formatter/key');
const fsExtra = require('fs-extra');
const {getCaService} = require('../config/caCryptoGen');
const helper = require('../app/helper');
const path = require('path');
const logger = require('khala-logger/log4js').consoleLogger('test:caCryptoGen');
const task = async (taskID) => {
	const domain = 'icdd';
	const caService = await getCaService(8054, domain);
	const admin = helper.getOrgAdminUser(domain);


	switch (taskID) {
		case 0:
			const {key, certificate, rootCertificate} = await caCryptoGen.genClientKeyPair(caService, {
				enrollmentID: `${domain}.client`,
				enrollmentSecret: 'password'
			}, admin, domain);
			const keyFile = path.resolve(__dirname, 'artifacts', 'clientKey');
			const certFile = path.resolve(__dirname, 'artifacts', 'clientCert');
			fsExtra.outputFileSync(certFile, certificate);
			const ecdsaKey = new ECDSA_Key(key, fsExtra);
			ecdsaKey.save(keyFile);
			break;
		case 1:
			const configuredCaCryptoGen = require('../config/caCryptoGen');
			try {
				await configuredCaCryptoGen.genUser({userName: 'david'.repeat(13), password: 'password'}, domain);
				logger.error('expect an error here');
			} catch (e) {
				logger.info(e);
				const regex = /{.*}/;
				const jsonString = e.message.match(regex)[0];
				logger.info('expect', jsonString);
				logger.inof('But', 'Identity \'daviddaviddaviddaviddaviddaviddaviddaviddaviddaviddaviddaviddavid@icdd\' is already registered"');

			}

			break;
	}
};
task(parseInt(process.env.taskID));
