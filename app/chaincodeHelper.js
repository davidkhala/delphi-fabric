const ChaincodeAction = require('../common/nodejs/chaincodeAction');
const ChaincodePackage = require('../common/nodejs/chaincodePackage');
const tmp = require('khala-nodeutils/tmp');
const path = require('path');

const chaincodeConfig = require('../config/chaincode.json');

const {exec} = require('khala-nodeutils/devOps');
/**
 * @returns {Promise<string>}
 */
const getGOPATH = async () => {
	const {stdout, stderr} = await exec('go env GOPATH');
	if (stderr) {
		throw Error(stderr);
	}
	return stdout.trim();
};
exports.prepareInstall = async ({chaincodeId}) => {
	const chaincodeRelativePath = chaincodeConfig[chaincodeId].path;
	const chaincodeType = chaincodeConfig[chaincodeId].type;
	const goPath = await getGOPATH();
	const chaincodePath = path.resolve(goPath, 'src', chaincodeRelativePath);
	const chaincodePackage = new ChaincodePackage({
		Path: chaincodeRelativePath,
		Type: chaincodeType,
		Label: chaincodeId
	});
	const [tmpDir, t1] = tmp.createTmpDir({unsafeCleanup: true});
	const ccPack = path.resolve(tmpDir, 'ccPackage.tar.gz');
	await chaincodePackage.pack(chaincodePath, ccPack);


	//TODO metadataPath = path.resolve(chaincodePath, 'META-INF');// the name is arbitrary

	//TODO couchDBIndex(metadataPath, undefined, ...chaincodeConfig[chaincodeId].couchDBIndexes);

	return [ccPack, t1];
};
exports.install = async (peers, {chaincodeId}, user) => {
	const [ccPack, t1] = await exports.prepareInstall({chaincodeId});
	const chaincodeAction = new ChaincodeAction(peers, user);
	const result = await chaincodeAction.install(ccPack);
	return [result, t1];
};

// const buildEndorsePolicy = (config) => {
// 	const {n} = config;
// 	const identities = [];
// 	for (const [mspid, type] of Object.entries(config.mspId)) {
// 		identities.push(RoleIdentity(mspid, type));
// 	}
// 	return simplePolicyBuilder(identities, n);
// };
// /**
//  * this should apply to both instantiate and upgrade
//  */
// const configParser = (configs) => {
// 	const {endorsingConfigs, collectionsConfig} = configs;
// 	const result = {};
// 	if (endorsingConfigs) {
// 		result.endorsementPolicy = buildEndorsePolicy(endorsingConfigs);
// 	}
// 	if (collectionsConfig) {
// 		const collectionSet = [];
// 		for (const [name, config] of Object.entries(collectionsConfig)) {
// 			const policy = collectionPolicyBuilder(config.mspIds);
// 			config.name = name;
// 			config.policy = policy;
// 			collectionSet.push(ensureCollectionConfig(config));
// 		}
// 		result.collectionConfig = collectionSet;
// 	}
// 	return result;
//
// };
//
// exports.upgrade = async (channel, richPeers, opts, orderer) => {
// 	const {chaincodeId} = opts;
// 	const policyConfig = configParser(chaincodeConfig[chaincodeId]);
//
// 	const eventHubs = richPeers.map(peer => new Eventhub(channel, peer));
//
// 	for (const eventHub of eventHubs) {
// 		await eventHub.connect();
// 	}
// 	const allConfig = Object.assign(policyConfig, opts);
// 	const proposalTimeOut = process.env.cicd ? 60000 * richPeers.length : undefined;
// 	try {
// 		return await incrementUpgrade(channel, richPeers, eventHubs, allConfig, orderer, proposalTimeOut);
// 	} catch (e) {
// 		for (const eventHub of eventHubs) {
// 			eventHub.disconnect();
// 		}
// 		throw e;
// 	}
//
// };
// exports.invoke = async (channel, peers, orderer, {chaincodeId, fcn, args, transientMap}, nonAdminUser, eventHubs) => {
// 	if (!eventHubs) {
// 		eventHubs = peers.map(peer => new Eventhub(channel, peer));
// 		for (const eventHub of eventHubs) {
// 			await eventHub.connect();
// 		}
// 	}
// 	const client = channel._clientContext;
// 	if (nonAdminUser) {
// 		ClientManager.setUser(client, nonAdminUser);
// 	}
//
//
// 	return await invoke(client, channel.getName(), peers, eventHubs, {
// 		chaincodeId,
// 		args,
// 		fcn,
// 		transientMap
// 	}, orderer);
//
// };
//
// exports.discoveryChaincodeInterestBuilder = (chaincodeIdFilter) => {
// 	let chaincodes = [];
// 	for (const [chaincodeID, config] of Object.entries(chaincodeConfig)) {
// 		if (typeof chaincodeIdFilter === 'function' && !chaincodeIdFilter(chaincodeID)) {
// 			continue;
// 		}
// 		const {collectionsConfig} = config;
// 		if (collectionsConfig) {
// 			const ccCalls = endorsementHintsBuilder({[chaincodeID]: Object.keys(collectionsConfig)});
// 			chaincodes = chaincodes.concat(ccCalls);
// 		}
// 	}
// 	return {chaincodes};
// };
// exports.query = async (channel, peers, {chaincodeId, fcn, args, transientMap}, proposalTimeout = 30000) => {
// 	const client = channel._clientContext;
// 	return transactionProposal(client, peers, channel.getName(), {
// 		chaincodeId,
// 		fcn,
// 		args,
// 		transientMap
// 	}, proposalTimeout);
// };
