const BaseClient = require('fabric-client/lib/BaseClient')
const fs = require('fs')
const User = require('fabric-client/lib/User')
const setDefaultCryptoSuite = (client) => {
	const newCryptoSuite = BaseClient.newCryptoSuite()
	newCryptoSuite.setCryptoKeyStore(BaseClient.newCryptoKeyStore())
	client.setCryptoSuite(newCryptoSuite)
	return client.getCryptoSuite()
}



/**
 * alternative to client.createUser, for old version only
 *
 * Returns a {@link User} object with signing identities based on the
 * private key and the corresponding x509 certificate. This allows applications
 * to use pre-existing crypto materials (private keys and certificates) to
 * construct user objects with signing capabilities, as an alternative to
 * dynamically enrolling users with [fabric-ca]{@link http://hyperledger-fabric-ca.readthedocs.io/en/latest/}
 * <br><br>
 * Note that upon successful creation of the new user object, it is set to
 * the client instance as the current <code>userContext</code>.
 * @param {Client} client instance
 * @param {UserOpts} opts - Essential information about the user
 * @returns {Promise} Promise for the user object.
 */
const createUser = (client, opts) => {
	const readFile = (path) => fs.readFileSync(path, 'utf8')

	if (!opts) {
		return Promise.reject(new Error('Client.createUser missing required \'opts\' parameter.'))
	}
	if (!opts.username) {
		return Promise.reject(new Error('Client.createUser parameter \'opts username\' is required.'))
	}
	if (!opts.mspid) {
		return Promise.reject(new Error('Client.createUser parameter \'opts mspid\' is required.'))
	}
	if (!opts.cryptoContent) {
		return Promise.reject(new Error('Client.createUser parameter \'opts cryptoContent\' is required.'))
	}

	const privateKeyData = opts.cryptoContent.privateKeyPEM
			? opts.cryptoContent.privateKeyPEM : readFile(opts.cryptoContent.privateKey)
	const signedCertData = opts.cryptoContent.signedCertPEM
			? opts.cryptoContent.signedCertPEM : readFile(opts.cryptoContent.signedCert)
	if (!privateKeyData) throw new Error('failed to load private key data')
	if (!signedCertData) throw new Error('failed to load signed cert data')
	if (client.getCryptoSuite() === null) {
		setDefaultCryptoSuite(client)
	}

	// need to load private key and pre-enrolled certificate from files based on the MSP
	// root MSP config directory structure:
	// <config>
	//    \_ keystore
	//       \_ admin.pem  <<== this is the private key saved in PEM file
	//    \_ signcerts
	//       \_ admin.pem  <<== this is the signed certificate saved in PEM file

	// first load the private key and save in the BCCSP's key store

	const opt1 = client.getCryptoSuite()._cryptoKeyStore ? { ephemeral: false } : { ephemeral: true }

	return client.getCryptoSuite().importKey(privateKeyData.toString(), opt1).then((key) => {
		const member = new User(opts.username)
		member.setCryptoSuite(client.getCryptoSuite())
		return member.setEnrollment(key, signedCertData, opts.mspid).then(() =>
				client.setUserContext(member, opts.skipPersistence).then(() => member)
		)
	})
}
exports.createUser = createUser
exports.setDefaultCryptoSuite = setDefaultCryptoSuite