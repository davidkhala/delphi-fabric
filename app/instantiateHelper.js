const {upgrade} = require('./chaincodeHelper');
const helper = require('./helper');
exports.upgrade = async (clientPeerOrg, peers, chaincodeId, fcn, args = [], transientMap, channelName = 'allchannel') => {
	const client = helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	return await upgrade(channel, peers, {fcn, chaincodeId, args, transientMap});
};
exports.instantiate = exports.upgrade;

