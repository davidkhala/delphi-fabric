const fs = require('fs')
const path = require('path')
const User = require('fabric-client/lib/User.js')
const fsExtra=require('fs-extra')
const logger= require('../helper').getLogger('ca-core')
exports.user = {
	// @return promise()
	build: (username, { key, certificate }, MSPID) => {
		const user = new User(username)
		return user.setEnrollment(key, certificate, MSPID).then(() => user)
	},

	register: (caService, { username, affiliation }, adminUser) =>
			register(caService, { enrollmentID: username, affiliation, role: 'user' }, adminUser)
	,
	toMSP: ({ key, certificate, rootCertificate }, mspDir, { username, domain }) => {
		toMSP({ key, certificate, rootCertificate }, mspDir, { name:username, delimiter: '@', domain })
	}
}

/**
 * @return {String} password
 */
const register = (caService, { enrollmentID, affiliation, role }, adminUser) => {
	return caService.register({
		enrollmentID,
		affiliation: affiliation.toLowerCase(),
		role,
		maxEnrollments:-1
	}, adminUser)
}
const revoke = (caService, { enrollmentID }, adminUser) => {
	// [[{"code":10002,"message":"Identity 'CAadmin' does not have attribute 'hf.Revoker'"}]]
	return caService.revoke({ enrollmentID }, adminUser)
}
const pkcs11_key = {
	generate: (cryptoSuite) =>
			cryptoSuite.generateKey({ ephemeral: true }).then(pkcs11_key => {
				//append for easy debug
				pkcs11_key.pem = {
					private: pkcs11_key.toBytes(), public: pkcs11_key.getPublicKey().toBytes()
				}
				return pkcs11_key
			})
	,
	toKeystore: (pkcs11_key, dirName) => {
		const filename = `${pkcs11_key._key.prvKeyHex}_sk`
		const absolutePath = path.join(dirName, filename)
		fs.writeFileSync(absolutePath, pkcs11_key.toBytes())
		return absolutePath
	},
	toServerKey:(pkcs11_key, dirName) => {
		const filename = 'server.key'
		const absolutePath = path.join(dirName, filename)
		fs.writeFileSync(absolutePath, pkcs11_key.toBytes())
		return absolutePath
	}

}
const peer = {
	revoke:(caService, { peerName}, adminUser)=>{
		return revoke(caService,{enrollmentID:peerName},adminUser)
	},
	/**
	 *
	 * unregister or delete is not supported
	 * @param caService
	 * @param peerName
	 * @param affiliation
	 * @param adminUser
	 * @return {String} password of this identity
	 */
	register: (caService, { peerName, affiliation }, adminUser) =>
			register(caService, { enrollmentID: peerName, affiliation, role: 'peer' }, adminUser)
	,
	toMSP: ({ key, certificate, rootCertificate }, mspDirName, { peerName, org_domain }) => {
		toMSP({ key, certificate, rootCertificate }, mspDirName, { name:peerName, delimiter: '.', domain:org_domain })
	},
	enroll:(caService,{peerName,password})=>
		caService.enroll({
			enrollmentID: peerName,
			enrollmentSecret: password
		})

}
const toMSP = ({ key, certificate, rootCertificate }, mspDirName, { name, delimiter, domain }) => {
	const cacertsDir = path.join(mspDirName, 'cacerts')
	const keystoreDir = path.join(mspDirName, 'keystore')
	const signcertsDir = path.join(mspDirName, 'signcerts')
	fsExtra.ensureDirSync(cacertsDir)
	fsExtra.ensureDirSync(keystoreDir)
	fsExtra.ensureDirSync(signcertsDir)
	fs.writeFileSync(path.join(cacertsDir, `ca.${domain}-cert.pem`), rootCertificate)
	pkcs11_key.toKeystore(key, keystoreDir)
	fs.writeFileSync(path.join(signcertsDir, `${name}${delimiter}${domain}-cert.pem`), certificate)

}
const toTLS=({ key, certificate, rootCertificate }, tlsDirName)=>{
	fsExtra.ensureDirSync(tlsDirName)
	pkcs11_key.toServerKey(key,tlsDirName)
	fs.writeFileSync(path.join(tlsDirName,'server.crt'),certificate)
	fs.writeFileSync(path.join(tlsDirName,'ca.crt'),rootCertificate)
}
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
const enroll = (caService, { enrollmentID, password }) =>
		caService.enroll({
			enrollmentID,
			enrollmentSecret: password
		})
const renew=(caService,user)=>{
	return caService.reenroll(user)
}
exports.register = register
exports.toMSP = toMSP
exports.enroll = enroll
exports.peer =peer