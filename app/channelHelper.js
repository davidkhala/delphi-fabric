const helper = require('./helper.js');
const {join: joinPeer, getGenesisBlock} = require('../common/nodejs/channel');
const {join: joinOrderer} = require('../common/nodejs/admin/orderer');
const logger = require('khala-logger/log4js').consoleLogger('channel helper');
const {ChannelConfig} = require('../common/nodejs/channelConfig');
const ConfigFactory = require('../common/nodejs/formatter/configFactory');
const {Status: {SERVICE_UNAVAILABLE}} = require('../common/nodejs/formatter/constants');
const {DeliverResponseType: {STATUS}} = require('../common/nodejs/formatter/eventHub');
const QueryHub = require('../common/nodejs/query');
const globalConfig = require('../config/orgs');
const {sleep, homeResolve} = require('khala-light-util');
const assert = require('assert');
const {axiosPromise} = require('khala-axios');

exports.joinAll = async (channelName) => {
	const channelConfig = globalConfig.channels[channelName];

	const blockFile = homeResolve(channelConfig.file);
	const channel = helper.prepareChannel(channelName);
	for (const ordererOrgName of Object.keys(globalConfig.orderer.organizations)) {
		const orderers = helper.newOrderers(ordererOrgName);

		for (const orderer of orderers) {
			const {clientKey, tlsCaCert, clientCert} = orderer;
			await joinOrderer(orderer.adminAddress, channelName, blockFile, axiosPromise, globalConfig.TLS ? {
				clientKey,
				tlsCaCert,
				clientCert
			} : undefined);
		}
	}

	// to make raft make consensus, do check after all joined
	for (const ordererOrgName of Object.keys(globalConfig.orderer.organizations)) {
		const orderers = helper.newOrderers(ordererOrgName);

		for (const orderer of orderers) {
			const user = helper.getOrgAdmin(ordererOrgName, 'orderer');
			await orderer.connect();
			const waitForGenesisBlock = async () => {
				try {
					await getGenesisBlock(channel, user, orderer);
				} catch ({status, Type}) {
					assert.strictEqual(status, SERVICE_UNAVAILABLE);
					assert.strictEqual(Type, STATUS);
					logger.warn(orderer.toString(), {status, Type});
					await sleep(1000);
					await waitForGenesisBlock();
				}
			};
			await waitForGenesisBlock();
		}
	}


	for (const [orgName, {peerIndexes}] of Object.entries(channelConfig.organizations)) {
		const peers = helper.newPeers(peerIndexes, orgName);
		const user = helper.getOrgAdmin(orgName);

		await joinPeer(channel, peers, user, blockFile);
		const queryHub = new QueryHub(peers, user);
		const JoinedResult = await queryHub.channelJoined();
		for (const [index, peer] of Object.entries(peers)) {
			logger.info(peer.toString(), 'has joined', JoinedResult[index]);
			assert.ok(JoinedResult[index].includes(channelName));
		}

	}

};
exports.setAnchorPeersByOrg = async (channelName, orgName, orderer) => {
	const orgConfig = globalConfig.channels[channelName].organizations[orgName];
	const {anchorPeerIndexes} = orgConfig;
	const user = helper.getOrgAdmin(orgName);

	const anchorPeers = anchorPeerIndexes.map(peerIndex => {
		const {container_name} = globalConfig.organizations[orgName].peers[peerIndex];
		return {host: container_name, port: 7051};
	});

	const channelConfig = new ChannelConfig(channelName, user, orderer);
	await channelConfig.setAnchorPeers(undefined, orgName, anchorPeers, true);

	const {json} = await channelConfig.getChannelConfigReadable();
	const updatedAnchorPeers = new ConfigFactory(json).getAnchorPeers(orgName);

	assert.deepStrictEqual(updatedAnchorPeers.value.anchor_peers, anchorPeers);

};
