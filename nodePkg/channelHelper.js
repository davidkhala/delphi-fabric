const Context = require('./index.js');
const ChannelUtil = require('khala-fabric-sdk-node/channel');
const {genesis} = require('khala-fabric-formatter/channel');
const ChannelManager = require('khala-fabric-sdk-node-builder/channel');
const {setAnchorPeers, getChannelConfigReadable, ConfigFactory} = require('khala-fabric-sdk-node/channelConfig');

const {create, join, getGenesisBlock} = ChannelUtil;
const {sleep} = require('khala-light-util');
const BinManager = require('khala-fabric-sdk-node/binManager');
const {CryptoPath} = require('khala-fabric-sdk-node/path');
const {adminName} = require('khala-fabric-formatter/user');

class ChannelHelper {
	constructor(globalConfig) {
		this.globalConfig = globalConfig;
		this.context = new Context(globalConfig);
	}

	async setAnchorPeersByOrg(channelName, OrgName) {
		const orderers = this.context.newOrderers();
		const orderer = orderers[0];
		const orgConfig = this.globalConfig.channels[channelName].organizations[OrgName];
		const {anchorPeerIndexes} = orgConfig;
		const client = this.context.getOrgAdmin(OrgName);
		const channel = Context.prepareChannel(channelName, client);

		const anchorPeers = [];
		for (const peerIndex of anchorPeerIndexes) {
			const {container_name} = this.globalConfig.organizations[OrgName].peers[peerIndex];
			anchorPeers.push({host: container_name, port: 7051});
		}
		await setAnchorPeers(channel, orderer, OrgName, anchorPeers);
		// TODO setup eventhub block listener here
		const ordererClient = this.context.getOrgAdmin(OrgName, 'orderer');
		ChannelManager.setClientContext(channel, ordererClient);
		const {configJSON} = await getChannelConfigReadable(channel, {orderer});
		const updatedAnchorPeers = new ConfigFactory(configJSON).getAnchorPeers(OrgName);
		if (JSON.stringify(updatedAnchorPeers) === JSON.stringify(anchorPeers)) {
			throw Error(`{OrgName:${OrgName} anchor peer updated failed: updatedAnchorPeers ${updatedAnchorPeers}`);
		}
	}

	/**
	 *
	 * @param {Client.Channel} channel
	 * @param channelConfigFile
	 * @param {Orderer} orderer
	 * @param {OrgName[]} extraSignerOrgs orgName array of signer
	 * @param {boolean} asEnvelop
	 * @returns {Promise<Client.BroadcastResponse>}
	 */
	async create(channel, channelConfigFile, orderer, extraSignerOrgs = [], asEnvelop) {
		let signers = undefined;
		const {orgsConfig, CRYPTO_CONFIG_DIR} = this.context;
		if (asEnvelop) {

			const binManager = new BinManager();
			if (extraSignerOrgs.length === 0) {
				extraSignerOrgs.push(this.context.randomOrg('peer'));
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
				const signingClient = this.context.getOrgAdmin(orgName);
				signers.push(signingClient);
			}
		}

		return create(channel, orderer, channelConfigFile, signers, asEnvelop);
	}


	// could not join peer to system channel 'testchainid'
	async joinAll(channelName) {

		const {channelsConfig} = this.context;
		const channelConfig = channelsConfig[channelName];
		const allOrderers = this.context.newOrderers();

		await sleep(1000);
		const orderer = allOrderers[0];
		let client;
		if (channelName === genesis) {
			client = this.context.getOrgAdmin(undefined, 'orderer');
		}
		for (const orgName in channelConfig.organizations) {
			const {peerIndexes} = channelConfig.organizations[orgName];
			const peers = this.context.newPeers(peerIndexes, orgName);

			client = this.context.getOrgAdmin(orgName);

			const channel = Context.prepareChannel(channelName, client);

			const block = await getGenesisBlock(channel, orderer);
			for (const peer of peers) {
				await join(channel, peer, block);
			}
		}

	}
}

module.exports = ChannelHelper;
