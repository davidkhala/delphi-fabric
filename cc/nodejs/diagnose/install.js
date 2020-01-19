const {installAll, incrementInstallAll} = require('../../../app/installHelper');
const {instantiate} = require('../../../app/instantiateHelper');

const chaincodeId = 'nodeDiagnose';
const helper = require('../../../app/helper');
exports.task = async (step) => {
	switch (step) {
		case 0:
			await installAll(chaincodeId);
			break;
		case 1:
			await incrementInstallAll(chaincodeId);
			break;
	}

	const org1 = 'astri.org';
	const peers = helper.newPeers([0], org1);
	await instantiate(org1, peers, chaincodeId);
};

