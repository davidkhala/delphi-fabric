const {invoke} = require('../../../app/invokeHelper');
const chaincodeId = 'stress';
exports.touch = async (peers, clientPeerOrg) => {
	return invoke(peers, clientPeerOrg, chaincodeId, undefined, []);
};
