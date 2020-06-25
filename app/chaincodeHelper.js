const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
const ChaincodePackage = require('../common/nodejs/chaincodePackage');
const tmp = require('khala-nodeutils/tmp');
const path = require('path');
const {discoveryChaincodeInterestBuilder} = require('../common/nodejs/serviceDiscovery');
const {EndorseALL} = require('../common/nodejs/endorseResultInterceptor');
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
const prepareInstall = async ({chaincodeId}) => {
	const chaincodeRelativePath = chaincodeConfig[chaincodeId].path;
	const chaincodeType = chaincodeConfig[chaincodeId].type;
	const goPath = await getGOPATH();
	const chaincodePath = path.resolve(goPath, 'src', chaincodeRelativePath);
	const chaincodePackage = new ChaincodePackage({
		Path: chaincodeRelativePath,
		Type: chaincodeType,
		Label: chaincodeId
	});
	const [tmpDir, t1] = tmp.createTmpDir();
	const ccPack = path.resolve(tmpDir, 'ccPackage.tar.gz');
	await chaincodePackage.pack(chaincodePath, ccPack);


	//TODO metadataPath = path.resolve(chaincodePath, 'META-INF');// the name is arbitrary

	//TODO couchDBIndex(metadataPath, undefined, ...chaincodeConfig[chaincodeId].couchDBIndexes);

	return [ccPack, t1];
};
const install = async (peers, {chaincodeId}, user) => {
	const [ccPack, t1] = await prepareInstall({chaincodeId});
	const chaincodeAction = new ChaincodeAction(peers, user, undefined, EndorseALL);
	chaincodeAction.setInitRequired(true);
	const result = await chaincodeAction.install(ccPack, true);
	return [result, t1];
};

const simplePolicyBuilder = (identities, n) => {
	return {
		identities,
		policy: {
			[`${n}-of`]: identities.map((e, i) => ({signedBy: i}))
		}
	};
};

const buildEndorsePolicy = (endorsingConfig) => { // TODO to support reference
	const {n, reference} = endorsingConfig;
	if (reference) {
		return {reference};
	}
	if (n) {
		const identities = [];
		for (const [mspid, type] of Object.entries(endorsingConfig.mspid)) {
			identities.push({role: {type, mspid}});
		}
		return {json: simplePolicyBuilder(identities, n)};
	}
};
const getEndorsePolicy = (chaincodeId) => {
	const {endorsingConfigs} = chaincodeConfig[chaincodeId];
	if (endorsingConfigs) {
		return buildEndorsePolicy(endorsingConfigs);
	}
};

const getCollectionConfig = (chaincodeId) => {
	const {collectionsConfig} = chaincodeConfig[chaincodeId];
	Object.values(collectionsConfig).forEach((config) => {
		const {endorsingConfigs} = config;
		if (endorsingConfigs) {
			config.endorsementPolicy = buildEndorsePolicy(endorsingConfigs);
		}
	});
	return collectionsConfig;
};


const discoveryChaincodeInterestTranslator = (chaincodeIDs) => {
	const translatedConfig = {};
	for (const chaincodeID of chaincodeIDs) {
		const {collectionsConfig} = chaincodeConfig[chaincodeID];

		if (collectionsConfig) {
			translatedConfig[chaincodeID] = Object.keys(collectionsConfig);
		} else {
			translatedConfig[chaincodeID] = null;
		}
	}
	return discoveryChaincodeInterestBuilder(translatedConfig);
};


module.exports = {
	getEndorsePolicy,
	getCollectionConfig,
	install,
	discoveryChaincodeInterestTranslator,
};
