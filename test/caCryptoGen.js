const caCryptoGen = require('../common/nodejs/ca-crypto-gen');
const {pkcs11_key} = require('../common/nodejs/ca');
const {fsExtra} = require('../common/nodejs/helper').nodeUtil.helper();
const {getCaService} = require('../config/caCryptoGen');
const helper = require('../app/helper');
const path = require('path');
const task = async () => {
	const domain = 'icdd';
	const caService = await getCaService(8054, domain);
	const admin = await helper.getOrgAdminUser(domain);
	const {key, certificate, rootCertificate} = await caCryptoGen.genClientKeyPair(caService, {
		enrollmentID: `${domain}.client`,
		enrollmentSecret: 'password'
	}, admin, domain);
	const keyFile = path.resolve(__dirname, 'artifacts', 'clientKey');
	const certFile = path.resolve(__dirname, 'artifacts', 'clientCert');
	fsExtra.outputFileSync(certFile, certificate);
	pkcs11_key.save(keyFile, key);
};
task();
