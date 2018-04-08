'use strict';
const fs = require('fs');
const path = require('path');
const User = require('fabric-client/lib/User.js');
const fsExtra = require('fs-extra');
const logger = require('./logger').new('ca-core');
const user = {
	/**
	 *
	 * @param username
	 * @param key
	 * @param certificate
	 * @param MSPID
	 * @return {Promise.<User>}
	 */
	build: (username, { key, certificate }, MSPID) => {
		const user = new User(username);
		return user.setEnrollment(key, certificate, MSPID).then(() => user);
	},
	register: (caService, { username, affiliation }, adminUser) =>
		register(caService, { enrollmentID: username, affiliation, role: 'user' }, adminUser),
	toMSP: ({ key, certificate, rootCertificate }, mspDir, { username, domain }) => {
		_toMSP({ key, certificate, rootCertificate }, mspDir, { name: username, delimiter: '@', domain });
	},
	enroll: (caService, { username, password }) =>
		enroll(caService, {
			enrollmentID: username,
			enrollmentSecret: password
		}),
	admin: {
		toMSP: ({ key, certificate, rootCertificate }, mspDir, { adminName, domain }) => {
			const admincerts = path.join(mspDir, 'admincerts');
			fsExtra.ensureDirSync(admincerts);
			fs.writeFileSync(path.join(admincerts, `${adminName}@${domain}-cert.pem`), certificate);
			user.toMSP({ key, certificate, rootCertificate }, mspDir, { username: adminName, domain });
		}
	}
};
exports.user = user;
exports.intermediateCA= {
	register: (caService, { enrollmentID, affiliation }, adminUser) =>{

		return caService.register({
			enrollmentID,
			affiliation: affiliation.toLowerCase(),
			role:'client',
			maxEnrollments: -1,
			attrs:[{name:'hf.IntermediateCA',value:'true'}]
		}, adminUser);
	}

};
const register = (caService, { enrollmentID, affiliation, role }, adminUser) => {
	return caService.register({
		enrollmentID,
		affiliation: affiliation.toLowerCase(),
		role,
		maxEnrollments: -1
	}, adminUser);
};
const revoke = (caService, { enrollmentID }, adminUser) => {
	// [[{"code":10002,"message":"Identity 'CAadmin' does not have attribute 'hf.Revoker'"}]]
	return caService.revoke({ enrollmentID }, adminUser);
};
const pkcs11_key = {
	generate: (cryptoSuite) => cryptoSuite.generateKey({ ephemeral: !cryptoSuite._cryptoKeyStore }),
	toKeystore: (pkcs11_key, dirName) => {
		const filename = `${pkcs11_key._key.prvKeyHex}_sk`;
		const absolutePath = path.join(dirName, filename);
		fs.writeFileSync(absolutePath, pkcs11_key.toBytes());
		return absolutePath;
	},
	toServerKey: (pkcs11_key, dirName) => {
		const filename = 'server.key';
		const absolutePath = path.join(dirName, filename);
		fs.writeFileSync(absolutePath, pkcs11_key.toBytes());
		return absolutePath;
	}

};
/**
 *
 * enroll
 * 1. generate a new privateKey
 * 2. generate csr from the privateKey
 * 3. fabricCAClient.enroll(id, secret, scr)
 * @return {Object} {key,certificate,rootCertificate}
 * rootCertificate: root cert of CA
 * @param caService
 * @param {Object} { enrollmentID:name, password }
 *
 */
const enroll = (caService, { enrollmentID, enrollmentSecret }) => {
	//generate enrollment certificate pair for signing

	return pkcs11_key.generate(caService.getCryptoSuite()).then(
		(privateKey) => {
			//generate CSR using enrollmentID for the subject
			//fixme pull request for fabric-node-sdk
			const csr = privateKey.generateCSR(`CN=${enrollmentID}`);
			return caService._fabricCAClient.enroll(enrollmentID, enrollmentSecret, csr).then(
				(enrollResponse) => Promise.resolve({
					key: privateKey,
					certificate: enrollResponse.enrollmentCert,
					rootCertificate: enrollResponse.caCertChain
				})
			);

		}
	);

};

const _toMSP = ({ key, certificate, rootCertificate }, mspDirName, { name, delimiter, domain }) => {
	const cacertsDir = path.join(mspDirName, 'cacerts');
	const keystoreDir = path.join(mspDirName, 'keystore');
	const signcertsDir = path.join(mspDirName, 'signcerts');
	fsExtra.ensureDirSync(cacertsDir);
	fsExtra.ensureDirSync(keystoreDir);
	fsExtra.ensureDirSync(signcertsDir);
	fs.writeFileSync(path.join(cacertsDir, `ca.${domain}-cert.pem`), rootCertificate);
	pkcs11_key.toKeystore(key, keystoreDir);
	fs.writeFileSync(path.join(signcertsDir, `${name}${delimiter}${domain}-cert.pem`), certificate);

};
const _toTLS = ({ key, certificate, rootCertificate }, tlsDir) => {
	fsExtra.ensureDirSync(tlsDir);
	pkcs11_key.toServerKey(key, tlsDir);
	fs.writeFileSync(path.join(tlsDir, 'server.crt'), certificate);
	fs.writeFileSync(path.join(tlsDir, 'ca.crt'), rootCertificate);
};
exports.toTLS = _toTLS;

exports.register = register;
exports.enroll = enroll;
exports.new = (caUrl, trustedRoots = []) => {
	const CAClient = require('fabric-ca-client/lib/FabricCAClientImpl');
	const tlsOptions = {
		trustedRoots,
		verify: trustedRoots.length > 0
	};

	return new CAClient(caUrl, tlsOptions);
};