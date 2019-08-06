const {installAll} = require('../../../app/installHelper');
const {instantiate} = require('../../../app/instantiateHelper');
const chaincodeId = 'mainChain';

const helper = require('../../../app/helper');
exports.task = async () => {
	await installAll(chaincodeId);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	const p1 = helper.newPeer(0, org1);
	const p2 = helper.newPeer(0, org2);
	await instantiate(org1, [p1, p2], chaincodeId);
};
