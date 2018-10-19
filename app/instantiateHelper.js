const {instantiate} = require('./chaincodeHelper');
const helper = require('./helper');

const channelName = 'allchannel';
const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;
const logger = require('../common/nodejs/logger').new('instantiateHelper');
exports.instantiate = async (peerOrg, chaincodeId, fcn, args) => {
	try {
		const {peerIndexes} = channels[channelName].orgs[peerOrg];
		const peers = helper.newPeers(peerIndexes, peerOrg);
		const client = await helper.getOrgAdmin(peerOrg);
		const channel = helper.prepareChannel(channelName, client, true);
		return instantiate(channel, peers, {fcn, chaincodeId, chaincodeVersion: 'v0', args});
	} catch (e) {
		logger.error(e);
		process.exit(1);
	}
};
