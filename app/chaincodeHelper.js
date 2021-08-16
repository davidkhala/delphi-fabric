const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
const ChaincodePackage = require('../common/nodejs/chaincodePackage');
const tmp = require('khala-nodeutils/tmp');
const path = require('path');
const {discoveryChaincodeInterestBuilder} = require('../common/nodejs/serviceDiscovery');
const chaincodeConfig = require('../config/chaincode.json');
const {couchDBIndex} = require('../common/nodejs/couchdb');
const {ChaincodeType: {golang}} = require('../common/nodejs/formatter/chaincode');

const {homeResolve} = require('khala-light-util');
const {execSync} = require('khala-light-util/index');

const prepareInstall = async ({chaincodeId}, binManager) => {
	const {path: chaincodeRelativePath, type: Type, couchDBIndexes} = chaincodeConfig[chaincodeId];
	const chaincodePath = homeResolve(chaincodeRelativePath);

	if (!Type || Type === golang) {
		execSync(`GO111MODULE=on && cd ${chaincodePath} && go mod vendor`);
	}

	const chaincodePackage = new ChaincodePackage({
		Path: chaincodePath,
		Type,
		Label: chaincodeId
	});
	const [tmpDir, t1] = tmp.createTmpDir();
	const ccPack = path.resolve(tmpDir, 'ccPackage.tar.gz');

	if (Array.isArray(couchDBIndexes)) {
		couchDBIndex(path.resolve(chaincodePath, 'META-INF'), undefined, undefined, ...couchDBIndexes);
	}
	// TODO clean vendor and re-install go vendor
	await chaincodePackage.pack(ccPack, binManager);


	return [ccPack, t1];
};
const install = async (peers, {chaincodeId}, user) => {
	const [ccPack, t1] = await prepareInstall({chaincodeId});
	const chaincodeAction = new ChaincodeAction(peers, user);
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

const buildEndorsePolicy = (endorsingConfig) => {
	const {n, reference} = endorsingConfig;
	if (reference) {
		if (reference === true) {
			return {reference: '/Channel/Application/Endorsement'};
		} else {
			return {reference};
		}
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
	if (collectionsConfig) {
		Object.values(collectionsConfig).forEach((config) => {
			const {endorsingConfigs} = config;
			if (endorsingConfigs) {
				config.endorsementPolicy = buildEndorsePolicy(endorsingConfigs);
			}
		});
	}
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
