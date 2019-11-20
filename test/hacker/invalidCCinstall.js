const {install} = require('../../app/chaincodeHelper');
const helper = require('../../app/helper');
const task = async () => {
	const clientOrg = 'icdd';
	const peerOrg = 'astri.org';
	const client = helper.getOrgAdmin(clientOrg);
	const peers = helper.newPeers([0], peerOrg);
	try {
		await install(peers, {chaincodeId: 'stress', chaincodeVersion: '0.0.0'}, client);
		console.error('assert failure, error is expected');
	} catch (e) {
		console.info('receive error expected');
		console.warn(e);
	}

};
task();
