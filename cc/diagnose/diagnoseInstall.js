const {installAll} = require('../../app/installHelper');
const {instantiate} = require('../../app/instantiateHelper');
const logger = require('../../common/nodejs/logger').new('install:diagnose', true);

const masterCC = 'diagnose';
const helper = require('../../app/helper');
exports.task = async () => {
	await installAll(masterCC);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	const p1 = helper.newPeers([0], org1)[0];
	const p2 = helper.newPeers([0], org2)[0];
	await instantiate(org1, [p1, p2], masterCC);
};
exports.taskAttach = async () => {
	const stress = 'mainChain';
	await installAll(stress);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	const p1 = helper.newPeers([0], org1)[0];
	const p2 = helper.newPeers([0], org2)[0];
	await instantiate(org1, [p1, p2], stress);
};