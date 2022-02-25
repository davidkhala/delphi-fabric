import assert from 'assert';
import * as helper from '../app/helper.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import {ECDSA_PrvKey} from '../common/nodejs/formatter/key.js';
import {getPrivateKey, getCertificate, getPublicKey, getMSPID} from '../common/nodejs/formatter/signingIdentity.js';

describe('user', () => {
	const user = helper.getOrgAdmin(undefined, 'orderer');
	assert.ok(!!user, 'user not found');
	const userBuilder = new UserBuilder(undefined, user);
	const signingIdentity = userBuilder.signingIdentity;

	it('private key pem', () => {
		const privateKey = getPrivateKey(signingIdentity);
		const ecdsaKey = new ECDSA_PrvKey(privateKey);
		assert.strictEqual(ecdsaKey.pem(), userBuilder.key);
	});
	it('certificate', () => {
		assert.strictEqual(userBuilder.certificate, getCertificate(signingIdentity));
	});

	it('public key', () => {
		const pubkey = getPublicKey(signingIdentity);
		console.debug(pubkey.toBytes());
	});
	it('mspid', () => {
		const mspid = getMSPID(signingIdentity);
		assert.strictEqual(userBuilder.mspId, mspid);
	});

});
