const {installAll, installs} = require('../../../app/installHelper');
const {instantiate} = require('../../../app/instantiateHelper');
const helper = require('../../../app/helper');
exports.task2 = async () => {
	await installAll('global');
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';

	const peers = helper.newPeers([0, 1], org1);
	await instantiate(org1, peers, 'global');


};
exports.task = async () => {
	await installAll('global');
	const org1 = 'ASTRI.org';
	const peers = helper.newPeers([0, 1], org1);
	await instantiate(org1, peers, 'global');
};
