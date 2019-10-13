const {panic} = require('../diagnoseInvoke');
const logger = require('../../../../common/nodejs/logger').new('invoke:diagnose', true);
const helper = require('../../../../app/helper');

const task = async () => {
	const org1 = 'icdd';
	const org2 = 'astri.org';
	let peers = [helper.newPeer(0, org1), helper.newPeer(0, org2)];
	await panic(peers, org1);
};
task();
