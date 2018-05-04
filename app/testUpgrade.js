const Upgrade = require('./instantiate-chaincode').upgrade;
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testUpgrade');
const Query = require('./query');
const chaincodeUtil = require('../common/nodejs/chaincode');

const chaincodeId = 'adminChaincode';

const args = [];

const channelName = 'delphiChannel';
const UpdateInstall = require('./install-chaincode').updateInstall;
const updateInstallAll = (chaincodeInfo) => {
	const orgName = 'BU';
	const peerIndexes = [0];
	return helper.getOrgAdmin(orgName).then((client) => {

		const peers = helper.newPeers(peerIndexes, orgName);
		return UpdateInstall(peers, {chaincodeId}, client);

	}).then(() => {
		const orgName = 'ENG';
		const peerIndexes = [0];
		return helper.getOrgAdmin(orgName).then((client) => {
			const peers = helper.newPeers(peerIndexes, orgName);
			return UpdateInstall(peers, {chaincodeId}, client);
		});

	}).then(() => {

		const chaincodeVersion = chaincodeUtil.nextVersion(chaincodeInfo.version);
		const orgName = 'BU';
		return helper.getOrgAdmin(orgName).then((client) => {
			const channel = helper.prepareChannel(channelName, client, true);
			const peers = helper.newPeers([0], orgName);
			return Upgrade(channel, peers, {chaincodeId, chaincodeVersion, args});
			//	NOTE: found all peers in channel will create chaincode container with new version for each, but the old version chaincode container remains
			//	entire KV DB will reset
		});

	});
};


helper.getOrgAdmin('PM').then((client) => {
	const testPeer = helper.newPeers([0], 'PM')[0];
	const channel = helper.prepareChannel(channelName, client, true);

	return Query.chaincodes.instantiated(testPeer, channel).then(({chaincodes}) => {
		const foundChaincode = chaincodes.find((element) => {
			return element.name === chaincodeId;
		});
		if (foundChaincode) {
			return Promise.resolve(foundChaincode);
		} else {
			return Promise.reject({chaincodes});
		}
	});

}).then(updateInstallAll).catch(err => {
	logger.error(err);
	return err;
});

//todo query installed
