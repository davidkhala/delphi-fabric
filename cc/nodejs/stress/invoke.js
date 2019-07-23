const {invoke, query} = require('../../../app/invokeHelper');
const chaincodeId = 'nodeStress';
exports.touch = async (peers, clientPeerOrg) => {
	const fcn = '';
	const args = [];
	return invoke(peers, clientPeerOrg, chaincodeId, fcn, args);
};

