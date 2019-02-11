const helper = require('../app/helper');
const {getUser} = require('../common/nodejs/client');
const {getPrivateKey} = require('../common/nodejs/user');
const test = async () => {
	const client = await helper.getOrgAdmin();
	const user = getUser(client);
	const key = getPrivateKey(user);
	console.log(key.pem);
};
test();
