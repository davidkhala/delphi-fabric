const {installAll} = require('../../../app/installHelper');
const {instantiate} = require('../../../app/instantiateHelper');
const chaincodeId = 'stupid';

const helper = require('../../../app/helper');
exports.task = async () => {
	await installAll(chaincodeId);
	const org2 = 'icdd';
	const p2 = helper.newPeer(0, org2);
	await instantiate(org2, [p2], chaincodeId);
};
