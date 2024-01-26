import {install} from '../app/chaincodeHelper.js';
import {getOrgAdmin, newPeers} from '../app/helper.js';

const chaincodeId = 'diagnose';
describe('install', function () {
	this.timeout(0);
	it('peer0.icdd', async () => {
		const orgName = 'icdd';
		const peers = newPeers([0], orgName);
		const user = getOrgAdmin(orgName);
		for (const peer of peers) {
			await peer.connect();
		}
		await install(peers, chaincodeId, user);
		for (const peer of peers) {
			peer.disconnect();
		}
	});
});