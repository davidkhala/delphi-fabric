const {install} = require('khala-fabric-sdk-node/chaincode');
const {ChaincodeType} = require('khala-fabric-formatter/chaincode');
const {invoke} = require('khala-fabric-sdk-node/chaincodeHelper');
const {incrementUpgrade} = require('khala-fabric-sdk-node/chaincodeVersion');
const {transactionProposal} = require('khala-fabric-sdk-node-builder/transaction');
const Eventhub = require('khala-fabric-sdk-node-builder/eventHub');
const golangUtil = require('khala-fabric-sdk-node/golang');
const {RoleIdentity, simplePolicyBuilder} = require('khala-fabric-sdk-node/policy');
const {collectionPolicyBuilder, ensureCollectionConfig} = require('khala-fabric-sdk-node/privateData');
const {couchDBIndex} = require('khala-fabric-sdk-node/couchdb');
const {endorsementHintsBuilder} = require('khala-fabric-sdk-node/serviceDiscovery');
const path = require('path');


class ChaincodeHelper {
	constructor(chaincodeConfig) {
		this.chaincodeConfig = chaincodeConfig;
	}

	async prepareInstall({chaincodeId}) {
		const chaincodeRelativePath = this.chaincodeConfig[chaincodeId].path;
		let metadataPath;
		let chaincodePath;
		const chaincodeType = this.chaincodeConfig[chaincodeId].type;
		const gopath = await golangUtil.getGOPATH();
		if (chaincodeType === ChaincodeType.node) {
			chaincodePath = path.resolve(gopath, 'src', chaincodeRelativePath);
			metadataPath = path.resolve(chaincodePath, 'META-INF');// the name is arbitrary
		}
		if (!chaincodeType || chaincodeType === ChaincodeType.golang) {
			await golangUtil.setGOPATH();
			chaincodePath = chaincodeRelativePath;
			metadataPath = path.resolve(gopath, 'src', chaincodeRelativePath, 'META-INF');// the name is arbitrary
		}
		if (Array.isArray(this.chaincodeConfig[chaincodeId].couchDBIndexes)) {
			couchDBIndex(metadataPath, undefined, ...this.chaincodeConfig[chaincodeId].couchDBIndexes);
		} else {
			metadataPath = undefined;
		}
		return {chaincodeId, chaincodePath, chaincodeType, metadataPath};
	}

	async install(peers, {chaincodeId, chaincodeVersion}, client) {
		const opt = await this.prepareInstall({chaincodeId});
		if (chaincodeVersion) {
			opt.chaincodeVersion = chaincodeVersion;
		}
		return install(peers, opt, client);
	}

	buildEndorsePolicy(config) {
		const {n} = config;
		const identities = [];
		for (const [mspid, type] of Object.entries(config.mspId)) {
			identities.push(RoleIdentity(mspid, type));
		}
		return simplePolicyBuilder(identities, n);
	}

	/**
	 * this should apply to both instantiate and upgrade
	 */
	configParser(configs) {
		const {endorsingConfigs, collectionsConfig} = configs;
		const result = {};
		if (endorsingConfigs) {
			result.endorsementPolicy = this.buildEndorsePolicy(endorsingConfigs);
		}
		if (collectionsConfig) {
			const collectionSet = [];
			for (const [name, config] of Object.entries(collectionsConfig)) {
				const policy = collectionPolicyBuilder(config.mspIds);
				config.name = name;
				config.policy = policy;
				collectionSet.push(ensureCollectionConfig(config));
			}
			result.collectionConfig = collectionSet;
		}
		return result;

	}

	async upgrade(channel, richPeers, opts, orderer) {
		const {chaincodeId} = opts;
		const policyConfig = this.configParser(this.chaincodeConfig[chaincodeId]);

		const eventHubs = richPeers.map(peer => new Eventhub(channel, peer));

		for (const eventHub of eventHubs) {
			await eventHub.connect();
		}
		const allConfig = Object.assign(policyConfig, opts);
		const proposalTimeOut = process.env.ci ? 60000 * richPeers.length : undefined;
		try {
			return await incrementUpgrade(channel, richPeers, eventHubs, allConfig, orderer, proposalTimeOut);
		} catch (e) {
			for (const eventHub of eventHubs) {
				eventHub.disconnect();
			}
			throw e;
		}
	}

	async invoke(channel, peers, orderer, {chaincodeId, fcn, args, transientMap}, eventHubs) {
		if (!eventHubs) {
			eventHubs = peers.map(peer => new Eventhub(channel, peer));
			for (const eventHub of eventHubs) {
				await eventHub.connect();
			}
		}
		const client = channel._clientContext;

		return await invoke(client, channel.getName(), peers, eventHubs, {
			chaincodeId,
			args,
			fcn,
			transientMap
		}, orderer);

	}

	discoveryChaincodeInterestBuilder(chaincodeIdFilter) {
		let chaincodes = [];
		for (const [chaincodeID, config] of Object.entries(this.chaincodeConfig)) {
			if (typeof chaincodeIdFilter === 'function' && !chaincodeIdFilter(chaincodeID)) {
				continue;
			}
			const {collectionsConfig} = config;
			if (collectionsConfig) {
				const ccCalls = endorsementHintsBuilder({[chaincodeID]: Object.keys(collectionsConfig)});
				chaincodes = chaincodes.concat(ccCalls);
			}
		}
		return {chaincodes};
	}

	async query(channel, peers, {chaincodeId, fcn, args, transientMap}, proposalTimeout = 30000 * peers.length) {
		const client = channel._clientContext;
		return transactionProposal(client, peers, channel.getName(), {
			chaincodeId,
			fcn,
			args,
			transientMap
		}, proposalTimeout);
	}
}

module.exports = ChaincodeHelper;
