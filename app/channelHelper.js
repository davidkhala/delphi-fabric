//TODO WIP
const helper = require('./helper.js');
const ChannelUtil = require('../common/nodejs/channel');
const {setAnchorPeers, getChannelConfigReadable} = require('../common/nodejs/channelConfig');
const ConfigFactory = require('../common/nodejs/formatter/configFactory');
const {create, join, getGenesisBlock} = ChannelUtil;
const {channelJoined} = require('../common/nodejs/query');
const globalConfig = require('../config/orgs');
const {sleep, homeResolve} = require('khala-light-util');
const BinManager = require('../common/nodejs/binManager');
const {CryptoPath} = require('../common/nodejs/path');
const {adminName} = require('../common/nodejs/formatter/user');
const {getIdentityContext} = require('../common/nodejs/admin/user');
const channelsConfig = globalConfig.channels;
exports.create = async (channelName, orderer, signerOrgs = [helper.randomOrg('peer')], asEnvelop) => {

	const channelConfig = channelsConfig[channelName];
	const channelFile = homeResolve(globalConfig.docker.volumes.CONFIGTX, channelConfig.file);
	const user = helper.getOrgAdmin(signerOrgs[0]);
	const signingIdentities = [];
	if (asEnvelop) {
		const CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);

		const binManager = new BinManager();
		const orgsConfig = globalConfig.organizations;

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
	for (const orgName in channelConfig.organizations) {
		const {peerIndexes} = channelConfig.organizations[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);
		const user = helper.getOrgAdmin(orgName);
		const channel = helper.prepareChannel(channelName);
		await join(channel, peers, user, block, orderer);
		await channelJoined(peers, getIdentityContext(user));
	}

};
exports.setAnchorPeersByOrg = async (channelName, orgName, viaServer) => {
	const orderers = helper.newOrderers();
	const orderer = orderers[0];
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
