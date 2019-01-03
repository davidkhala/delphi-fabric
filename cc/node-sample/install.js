const {installAll} = require('../../app/installHelper');
const {instantiate} = require('../../app/instantiateHelper');

const cc = 'nodeSample';
const helper = require('../../app/helper');
exports.task = async () => {
	await installAll(cc);

	const org1 = 'ASTRI.org';
	const p1 = helper.newPeer(0, org1);
	await instantiate(org1, [p1], cc);
};
