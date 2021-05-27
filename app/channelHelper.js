const helper = require('./helper.js');
const {join: joinPeer} = require('../common/nodejs/channel');
const {join: joinOrderer} = require('../common/nodejs/admin/orderer');
const logger = require('khala-logger/log4js').consoleLogger('channel helper');
const {setAnchorPeers, getChannelConfigReadable} = require('../common/nodejs/channelConfig');
const ConfigFactory = require('../common/nodejs/formatter/configFactory');
const QueryHub = require('../common/nodejs/query');
const globalConfig = require('../config/orgs');
const {sleep, homeResolve} = require('khala-light-util');

const {axiosPromise} = require('khala-axios');

exports.joinAll = async (channelName) => {
	const channelConfig = globalConfig.channels[channelName];

	const blockFile = homeResolve(channelConfig.file);

	const orderers = helper.newOrderers();

	for (const orderer of orderers) {
		const {clientKey, tlsCaCert, clientCert} = orderer;

		await joinOrderer(orderer.adminAddress, channelName, blockFile, axiosPromise, globalConfig.TLS ? {
			clientKey,
			tlsCaCert,
			clientCert
		} : undefined);
	}

	await sleep(1000);

	for (const [orgName, {peerIndexes}] of Object.entries(channelConfig.organizations)) {
		const peers = helper.newPeers(peerIndexes, orgName);
		const user = helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName);
		await joinPeer(channel, peers, user, blockFile);
		const queryHub = new QueryHub(peers, user);
		const JoinedResult = await queryHub.channelJoined();
		for (const [index, peer] of Object.entries(peers)) {
			logger.info(peer.toString(), 'has joined', JoinedResult[index]);
		}

	}

};
exports.setAnchorPeersByOrg = async (channelName, orgName, orderer, viaServer) => {
	const orgConfig = globalConfig.channels[channelName].organizations[orgName];
	const {anchorPeerIndexes} = orgConfig;
	const user = helper.getOrgAdmin(orgName);

	const anchorPeers = [];
	for (const peerIndex of anchorPeerIndexes) {
		const {container_name} = globalConfig.organizations[orgName].peers[peerIndex];
		anchorPeers.push({host: container_name, port: 7051});
	}
	await setAnchorPeers(channelName, orderer, user, [], orgName, anchorPeers, viaServer);

	const {json} = await getChannelConfigReadable(channelName, user, orderer, viaServer);
	const updatedAnchorPeers = new ConfigFactory(json).getAnchorPeers(orgName);
	if (JSON.stringify(updatedAnchorPeers) === JSON.stringify(anchorPeers)) {
		throw Error(`{OrgName[${orgName}] anchor peer updated failed: updatedAnchorPeers ${updatedAnchorPeers}`);
	}
};
