const install = require('../diagnoseInstall');
const {setEvent} = require('../diagnoseInvoke');
const chaincodeId = 'nodeDiagnose';
const helper = require('../../../../app/helper');
const {listenChaincodeEvent} = require('../../../../app/invokeHelper');
const task = async () => {
	const org1 = 'astri.org';
	await install.partialInstall(org1, [0]);
	const endorsePeers = helper.newPeers([0], org1);


	const org2 = 'icdd';
	const commitPeer = helper.newPeer(0, org1);
	const onSuccess = (data) => {
		console.info('onSucc CCEvent', data);
	};
	await listenChaincodeEvent(commitPeer, org1, chaincodeId, /a/i, onSuccess);

	await setEvent(endorsePeers, org1, {name: "a", event: "b"});

};

task();

