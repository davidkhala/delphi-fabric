//TODO WIP
const helper = require('./helper.js');
const ChannelUtil = require('../common/nodejs/channel');
// const {setAnchorPeers, getChannelConfigReadable, ConfigFactory} = require('../common/nodejs/channelConfig');

const {create, join, updateAnchorPeers, getGenesisBlock} = ChannelUtil;

const {genAnchorPeers} = require('../common/nodejs/binManager');
const globalConfig = require('../config/orgs');
const {sleep, homeResolve} = require('khala-light-util');
const BinManager = require('../common/nodejs/binManager');
const {CryptoPath} = require('../common/nodejs/path');
const {adminName} = require('../common/nodejs/formatter/user');
const channelsConfig = globalConfig.channels;
exports.create = async (channelName, orderer, signerOrgs = [helper.randomOrg('peer')], asEnvelop) => {

	const channelConfig = channelsConfig[channelName];
	const channelFile = homeResolve(globalConfig.docker.volumes.CONFIGTX, channelConfig.file);
	const user = helper.getOrgAdmin(signerOrgs[0]);
	const signingIdentities = [];
	if (asEnvelop) {
		const CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);

		const binManager = new BinManager();
		const orgsConfig = globalConfig.orgs;

		for (const orgName of signerOrgs) {
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
			await binManager.peer().signconfigtx(channelFile, localMspId, mspConfigPath);
		}
	} else {
		for (const orgName of signerOrgs) {
			const adminUser = helper.getOrgAdmin(orgName);
			signingIdentities.push(adminUser.getSigningIdentity());
		}
	}

	return await create(channelName, user, orderer, channelFile, signingIdentities, asEnvelop);
};


exports.joinAll = async (channelName, block, orderer) => {

	const channelConfig = globalConfig.channels[channelName];
	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);
		const user = helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName);
		await join(channel, peers, user, block, orderer);
	}

};
//TODO migration
exports.setAnchorPeersByOrg = async (channelName, OrgName) => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
	const orgConfig = globalConfig.channels[channelName].orgs[OrgName];
	const {anchorPeerIndexes} = orgConfig;
	const client = helper.getOrgAdmin(OrgName);
	const channel = helper.prepareChannel(channelName);

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
