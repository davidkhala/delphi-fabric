import {installs} from '../app/installHelper.js';
const chaincodeId = 'diagnose'
describe('install', function () {
	this.timeout(0);
	it('peer0.icdd', async () => {
		const orgName ='icdd'
		const peerIndexes = [0]
		try {
			await installs(chaincodeId, orgName, peerIndexes)
		}catch (e){
			console.debug(e)
		}


	});
});