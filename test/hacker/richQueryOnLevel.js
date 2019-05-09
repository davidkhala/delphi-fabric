const helper = require('../../app/helper');
const {richQuery} = require('../../cc/diagnose/diagnoseInvoke');
const task = async () => {
	const org1 = 'icdd';
	const peers = helper.newPeers([0], org1);
	try {
		await richQuery(peers, org1);
		console.error('error expect', 'richQuery should fail');
	} catch (e) {
		console.info('error expect');
		console.warn(e.proposalResponses[0]);
	}

};
task();
