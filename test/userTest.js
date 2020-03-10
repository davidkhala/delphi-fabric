const helper = require('../app/helper');
const {getUser} = require('../common/nodejs/builder/client');
const {getPrivateKey} = require('../common/nodejs/user');
const ECDSAPRIV = require('../common/nodejs/key');
const test = async () => {
	const client = helper.getOrgAdmin();
	const user = getUser(client);
	const key = getPrivateKey(user);
	const ecdsaKey = new ECDSAPRIV(key);
	console.log(ecdsaKey.pem());
};
test();
