const helper = require('../app/helper');
const UserBuilder = require('../common/nodejs/admin/user');
const {ECDSA_Key} = require('../common/nodejs/formatter/key');
const {getPrivateKey, getCertificate, getPublicKey, getMSPID} = require('../common/nodejs/formatter/signingIdentity');
const logger = require('khala-logger/log4js').consoleLogger('user');
describe('user', () => {
	const user = helper.getOrgAdmin();
	const userBuilder = new UserBuilder(undefined, user);
	const signingIdentity = userBuilder.getSigningIdentity();
	it('private key pem', () => {
		const privateKey = getPrivateKey(signingIdentity);
		const ecdsaKey = new ECDSA_Key(privateKey);
		logger.debug(ecdsaKey.pem());
	});
	it('certificate', () => {
		const certificate = getCertificate(signingIdentity);
		logger.debug(certificate);// TODO check equality with input
	});

	it('public key', () => {
		const pubkey = getPublicKey(signingIdentity);
		const ecdsaKey = new ECDSA_Key(pubkey);
		logger.debug(ecdsaKey.pem());
	});
	it('mspid', () => {
		const mspid = getMSPID(signingIdentity);
		logger.debug(mspid);
	});

});
