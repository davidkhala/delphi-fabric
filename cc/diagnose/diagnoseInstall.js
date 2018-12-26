const {installAll} = require('../../app/installHelper');
const {instantiate} = require('../../app/instantiateHelper');

const masterCC = 'diagnose';
const helper = require('../../app/helper');
exports.task = async () => {
	await installAll(masterCC);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	const p1 = helper.newPeer(0, org1);
	const p2 = helper.newPeer(0, org2);
	await instantiate(org1, [p1, p2], masterCC);
};
exports.taskAttach = async () => {
	const prone = 'mainChain';
	await installAll(prone);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	const p1 = helper.newPeer(0, org1);
	const p2 = helper.newPeer(0, org2);
	await instantiate(org1, [p1, p2], prone);
};