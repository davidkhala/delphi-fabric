const helper = require('../app/helper');
const {getUser} = require('../common/nodejs/client');//TODO
const UserBuilder = require('../common/nodejs/admin/user');
const {ECDSA_Key} = require('../common/nodejs/formatter/key');
const task = async (taskID) => {
	const client = helper.getOrgAdmin();
	const user = getUser(client);
	const userBuilder = new UserBuilder(undefined, user);
	switch (parseInt(taskID)) {
		case 0: {
			const privateKey = userBuilder.getPrivateKey();
			const ecdsaKey = new ECDSA_Key(privateKey);
			console.log(ecdsaKey.pem());
		}
			break;
		case 1: {
			const certificate = userBuilder.getCertificate();
			console.log(certificate);// TODO check equality with input
		}
			break;
		case 2: {
			const pubkey = userBuilder.getPublicKey();
			const ecdsaKey = new ECDSA_Key(pubkey);
			console.log(ecdsaKey.pem());
		}
			break;
		case 3: {
			const mspId = userBuilder.getMSPID();
			console.log(mspId);
		}
			break;

	}

};
task(process.env.taskID);
