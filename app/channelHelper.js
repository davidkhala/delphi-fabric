const helper = require('./helper.js');
const ChannelUtil = require('../common/nodejs/channel');
const {genesis} = require('../common/nodejs/formatter/channel');
const ChannelManager = require('../common/nodejs/builder/channel');
const OrdererManager = require('../common/nodejs/builder/orderer');
const {setAnchorPeers, getChannelConfigReadable, ConfigFactory} = require('../common/nodejs/channelConfig');

const {create, join, getGenesisBlock} = ChannelUtil;
const globalConfig = require('../config/orgs');
const {sleep, homeResolve} = require('khala-nodeutils/helper');
const BinManager = require('../common/nodejs/binManager');
const {CryptoPath} = require('../common/nodejs/path');
const {adminName} = require('../common/nodejs/formatter/user');
/**
 *
 * @param {Client.Channel} channel
 * @param channelConfigFile
 * @param {Orderer} orderer
 * @param {OrgName[]} extraSignerOrgs orgName array of signer
 * @param {boolean} asEnvelop
 * @returns {Promise<Client.BroadcastResponse>}
 */
exports.create = async (channel, channelConfigFile, orderer, extraSignerOrgs = [], asEnvelop) => {
	let signers = undefined;
	if (asEnvelop) {
		const CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);

		const binManager = new BinManager();
		const orgsConfig = globalConfig.orgs;
		if (extraSignerOrgs.length === 0) {
			extraSignerOrgs.push(helper.randomOrg('peer'));
		}
		for (const orgName of extraSignerOrgs) {
			const localMspId = orgsConfig[orgName].mspid;
			const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
				peer: {
					org: orgName
				},
				user: {
					name: adminName
				}
			});
			const mspConfigPath = cryptoPath.MSP('peerUser');
			await binManager.peer().signconfigtx(channelConfigFile, localMspId, mspConfigPath);
		}
	} else {
		signers = [channel._clientContext];
		// extract the channel config bytes from the envelope to be signed
		for (const orgName of extraSignerOrgs) {
			const signingClient = helper.getOrgAdmin(orgName);
			signers.push(signingClient);
		}
	}

	return create(channel, orderer, channelConfigFile, signers, asEnvelop);
};

// could not join peer to system channel 'testchainid'
exports.joinAll = async (channelName) => {

	const channelConfig = globalConfig.channels[channelName];
	const allOrderers = helper.newOrderers();
	const filter = async (orderers) => {
		const result = [];
		for (const orderer of orderers) {
			const isAlive = await OrdererManager.ping(orderer);
			if (!isAlive) {
				continue;
			}
			result.push(orderer);
		}
		return result;
	};
	const waitForOrderer = async () => {
		const orderers = await filter(allOrderers);
		if (orderers.length === 0) {
			await sleep(1000);
			return waitForOrderer();
		}
		return orderers[0];
	};
	const orderer = await waitForOrderer();
	let client;
	if (channelName === genesis) {
		client = helper.getOrgAdmin(undefined, 'orderer');
	}
	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		client = helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);

		const block = await getGenesisBlock(channel, orderer);
		for (const peer of peers) {
			await join(channel, peer, block);
		}
	}

};

exports.setAnchorPeersByOrg = async (channelName, OrgName) => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const orgConfig = globalConfig.channels[channelName].orgs[OrgName];
	const {anchorPeerIndexes} = orgConfig;
	const client = helper.getOrgAdmin(OrgName);
	const channel = helper.prepareChannel(channelName, client);

	const anchorPeers = [];
	for (const peerIndex of anchorPeerIndexes) {
		const {container_name} = globalConfig.orgs[OrgName].peers[peerIndex];
		anchorPeers.push({host: container_name, port: 7051});
	}
	await setAnchorPeers(channel, orderer, OrgName, anchorPeers);
	// TODO setup eventhub block listener here
	const ordererClient = helper.getOrgAdmin(OrgName, 'orderer');
	ChannelManager.setClientContext(channel, ordererClient);
	const {configJSON} = await getChannelConfigReadable(channel, {orderer});
	const updatedAnchorPeers = new ConfigFactory(configJSON).getAnchorPeers(OrgName);
	if (JSON.stringify(updatedAnchorPeers) === JSON.stringify(anchorPeers)) {
		throw Error(`{OrgName:${OrgName} anchor peer updated failed: updatedAnchorPeers ${updatedAnchorPeers}`);
	}
};

