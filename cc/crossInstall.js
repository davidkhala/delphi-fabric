const {installAll} = require('../app/installHelper');
const {instantiate} = require('../app/instantiateHelper');
const mainCC = 'mainChain';
const sideCC = 'sideChain';
const sideCC2 = 'sideChain2';
const helper = require('../app/helper');
const task = async () => {
	await installAll(mainCC);
	await installAll(sideCC);
	await installAll(sideCC2);
	const org1 = 'ASTRI.org';
	const org2 = 'icdd';
	const p1 = helper.newPeers([0], org1)[0];
	const p2 = helper.newPeers([0], org2)[0];
	await instantiate(org1, [p1, p2], mainCC);
	await instantiate(org2, [p1, p2], sideCC);
	await instantiate(org1, [p1, p2], sideCC2);
};
task();