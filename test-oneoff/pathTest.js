const {getOneKeystore} = require('../common/nodejs/formatter/path');
const {projectResolve} = require('../app/helper');
describe('nodejs/formatter/path', () => {
	it('getOneKeystore', async () => {
		const dir = projectResolve('config/ca-crypto-config/peerOrganizations/icdd/users/Admin@icdd/msp/keystore');
		console.info({dir});
		const key = getOneKeystore(dir);
		console.info({key});
	});
});