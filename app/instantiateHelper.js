const {instantiate} = require('./chaincodeHelper');
const helper = require('./helper');

const channelName = 'allchannel';
const logger = require('../common/nodejs/logger').new('instantiateHelper');
exports.instantiate = async (clientPeerOrg, peers, chaincodeId, fcn, args = []) => {
	try {
		const client = await helper.getOrgAdmin(clientPeerOrg);
		const channel = helper.prepareChannel(channelName, client, true);
		return instantiate(channel, peers, {fcn, chaincodeId, chaincodeVersion: 'v0', args});
	} catch (e) {
		logger.error(e);
		process.exit(1);
	}
};
