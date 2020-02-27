const {incrementInstallAll} = require('../../../app/installHelper');
const {upgrade} = require('../../../app/instantiateHelper');

const chaincodeId = 'nodeContracts';
const helper = require('../../../app/helper');
const taskInstallNInit = async () => {
	await incrementInstallAll(chaincodeId);
	const org1 = 'astri.org';
	const peers = helper.newPeers([0], org1);
	await upgrade(org1, peers, chaincodeId);
};


const task = async (taskID) => {
	switch (taskID) {
		default:
			await taskInstallNInit();
	}
};

task(process.env.taskID);