const {upgrade} = require('./chaincodeHelper');
const helper = require('./helper');
const channelName = 'allchannel';
exports.upgrade = async (clientPeerOrg, peers, chaincodeId, fcn, args = [], transientMap) => {
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	return await upgrade(channel, peers, {fcn, chaincodeId, args, transientMap});
};
exports.instantiate = exports.upgrade;

