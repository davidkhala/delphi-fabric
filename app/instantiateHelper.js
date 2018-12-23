const {instantiate} = require('./chaincodeHelper');
const helper = require('./helper');
const {nextVersion} = require('khala-nodeutils/version')
const channelName = 'allchannel';
exports.instantiate = async (clientPeerOrg, peers, chaincodeId, fcn, args = []) => {
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	return instantiate(channel, peers, {fcn, chaincodeId, chaincodeVersion: nextVersion(), args});
};
