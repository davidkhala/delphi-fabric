const install = require('../index');
const {setEvent} = require('../diagnoseInvoke');
const helper = require('../../../../app/helper');
const {listenChaincodeEvent} = require('../../../../app/invokeHelper');
const chaincodeId = 'diagnose';
const task = async () => {
	const org1 = 'astri.org';
	// await install.partialInstall(org1, [0]);
	const endorsePeers = helper.newPeers([0], org1);


	const org2 = 'icdd';

	const peer = helper.newPeer(0, org2);
	const onSuccess = (data) => {

	};
	const listener = await listenChaincodeEvent(peer, org2, chaincodeId, 'a', onSuccess);
	await setEvent(endorsePeers, org1, {name: 'a', event: 'b'});

};

task();

