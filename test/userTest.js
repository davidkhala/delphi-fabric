const helper = require('../app/helper');
const UserBuilder = require('../common/nodejs/admin/user');
const {ECDSA_PrvKey} = require('../common/nodejs/formatter/key');
const {getPrivateKey, getCertificate, getPublicKey, getMSPID} = require('../common/nodejs/formatter/signingIdentity');
const assert = require('assert');
const logger = require('khala-logger/log4js').consoleLogger('user');

describe('user', () => {
	const user = helper.getOrgAdmin(undefined, 'orderer');
	assert.ok(!!user, 'user not found');
	const userBuilder = new UserBuilder(undefined, user);
	const signingIdentity = userBuilder.getSigningIdentity();

	it('private key pem', () => {
		const privateKey = getPrivateKey(signingIdentity);
		const ecdsaKey = new ECDSA_PrvKey(privateKey);
		logger.debug(ecdsaKey.pem());
	});
	it('certificate', () => {
		logger.debug(getCertificate(signingIdentity));
	});

	it('public key', () => {
		const pubkey = getPublicKey(signingIdentity);
		console.debug(pubkey.toBytes());
	});
	it('mspid', () => {
		const mspid = getMSPID(signingIdentity);
		logger.debug(mspid);
	});

});
