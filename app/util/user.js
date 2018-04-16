const fsExtra = require('fs-extra');
const fs = require('fs');
const path = require('path');
const pathUtil = require('./path');
const clientUtil = require('./client');
const logger = require('./logger').new('userUtil');
exports.formatUsername = (username, domain) => `${username}@${domain}`;
const User = require('fabric-client/lib/User');
/**
 *
 * @param userMSPRoot
 * @param cryptoSuite
 * @param username
 * @param domain: with orgName like orgName.domain
 * @param mspid
 * @returns {Promise|*|Promise<User>}
 */
exports.loadFromLocal = (userMSPRoot, cryptoSuite, {username, domain, mspId}) => {
	fsExtra.ensureDirSync(userMSPRoot);

	const keystoreDir = path.resolve(userMSPRoot, 'keystore');
	const signcertsDir = path.resolve(userMSPRoot, 'signcerts');

	if (!cryptoSuite) {
		cryptoSuite = clientUtil.newCryptoSuite();
	}
	const fileName = `${module.exports.formatUsername(username, domain)}-cert.pem`;
	const signcertFile = path.resolve(signcertsDir, fileName);

	if (!fs.existsSync(keystoreDir)) return Promise.resolve();
	const keyFile = pathUtil.findKeyfiles(keystoreDir)[0];
	// NOTE:(jsdoc) This allows applications to use pre-existing crypto materials (private keys and certificates) to construct user objects with signing capabilities
	// NOTE In client.createUser option, two types of cryptoContent is supported:
	// 1. cryptoContent: {		privateKey: keyFilePath,signedCert: certFilePath}
	// 2. cryptoContent: {		privateKeyPEM: keyFileContent,signedCertPEM: certFileContent}

	const readFile = (path) => fs.readFileSync(path, 'utf8');

	if (!fs.existsSync(keyFile)) return Promise.resolve();
	if (!fs.existsSync(signcertFile)) return Promise.resolve();

	const user = new User(username);
	user.setCryptoSuite(cryptoSuite);

	//FIXME: importKey.then is not function in some case;
	const privateKey = cryptoSuite.importKey(readFile(keyFile).toString(), {ephemeral: true});
	return user.setEnrollment(privateKey, readFile(signcertFile), mspId)
		.then(() => user);
};
exports.build = (username, {key, certificate}, MSPID) => {
	const user = new User(username);
	return user.setEnrollment(key, certificate, MSPID).then(() => user);
};
exports.getCertificate = (user) => {
	return user.getSigningIdentity()._certificate;
};