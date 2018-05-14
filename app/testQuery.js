const query = require('../common/nodejs/query');
const helper = require('./helper');

const channelName = 'allchannel';

const logger = require('../common/nodejs/logger').new('test-query');

const queryInstantiated = async () => {
	const orgName = 'PM.Delphi.com';
	const peerIndexes = [0];
	const peers = helper.newPeers(peerIndexes, orgName);

	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	const result = await query.chaincodes.instantiated(peers[0], channel);
	logger.info('queryInstantiated',result);
	return result;

};
const queryInstalled = async () => {
	const orgName = 'PM.Delphi.com';
	const peerIndexes = [0];
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);

	const result = await query.chaincodes.installed(peers[0], client);
	logger.info('queryInstalled',result);
	return result;
};

const queryHeight = async () => {
	const orgName = 'BU.Delphi.com';
	const peerIndexes = [0];
	const peers = helper.newPeers(peerIndexes, orgName);
	const client = await helper.getOrgAdmin(orgName);
	const channel = helper.prepareChannel(channelName, client, true);
	const message = await query.chain(peers[0], channel);
	logger.info(message.pretty);
	return message.pretty;
};
queryHeight();
queryInstalled();
queryInstantiated();