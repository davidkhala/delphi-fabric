const query = require('./query');
const helper = require('./helper');

const channelName = 'delphiChannel';

const logger = require('./util/logger').new('test-query');

const queryInstantiated = () => {
	const orgName = 'PM';
	const peerIndexes = [0];
	const peers = helper.newPeers(peerIndexes, orgName);

	return helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client, true);
		return query.chaincodes.instantiated(peers[0], channel).then((result) => {
			logger.info(result);
			return Promise.resolve(result);
		});

	});
};
const queryInstalled = () => {
	const orgName = 'PM';
	const peerIndexes = [0];
	const peers = helper.newPeers(peerIndexes, orgName);
	return helper.getOrgAdmin(orgName).then((client) => {

		return query.chaincodes.installed(peers[0], client).then((result) => {
			logger.info(result);
			return Promise.resolve(result);
		});

	});
};

const queryHeight = () => {
	const orgName = 'BU';
	const peerIndexes = [0];
	const peers = helper.newPeers(peerIndexes, orgName);
	return helper.getOrgAdmin(orgName).then((client)=>{
		const channel = helper.prepareChannel(channelName, client, true);
		return query.chain(peers[0],channel);
	}).then(message=>{
		logger.info(message.pretty);
	});
};
queryHeight();