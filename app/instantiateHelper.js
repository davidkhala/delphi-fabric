const {upgrade} = require('./chaincodeHelper');
const helper = require('./helper');
exports.upgrade = async (clientPeerOrg, peers, chaincodeId, fcn, args = [], transientMap, channelName = 'allchannel') => {
	const client = helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client);
	const orderer = helper.newOrderers()[0];
	return await upgrade(channel, peers, {fcn, chaincodeId, args, transientMap}, orderer);
};
exports.instantiate = exports.upgrade;

