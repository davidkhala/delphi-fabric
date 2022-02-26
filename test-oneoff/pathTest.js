import {getOneKeystore} from '../common/nodejs/formatter/path.js';
import {projectResolve} from '../app/helper.js';
describe('nodejs/formatter/path', () => {
	it('getOneKeystore', async () => {
		const dir = projectResolve('config/ca-crypto-config/peerOrganizations/icdd/users/Admin@icdd/msp/keystore');
		console.info({dir});
		const key = getOneKeystore(dir);
		console.info({key});
	});
});