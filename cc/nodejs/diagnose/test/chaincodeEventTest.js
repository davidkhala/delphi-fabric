const install = require('../install');
const {setEvent} = require('../invoke');
const chaincodeId = 'nodeDiagnose';
const helper = require('../../../../app/helper');
const EventHub = require('../../../../common/nodejs/eventHub');
const task = async () => {
	const org1 = 'astri.org';
	await install.partialInstall(org1, [0]);
	const peers = helper.newPeers([0], org1);
	await setEvent(peers, org1, 'a', 'b');

	const org2 = 'icdd';
	const commitPeers = helper.newPeers([0], org2);

};

task();

