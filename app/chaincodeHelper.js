import {createTmpDir} from '@davidkhala/nodeutils/tmp.js';
import path from 'path';
import {homeResolve} from '@davidkhala/light/index.js';
import {execSync} from '@davidkhala/light/devOps.js';
import {importFrom} from '@davidkhala/light/es6.mjs';
import ChaincodeAction from '../common/nodejs/chaincodeOperation.js';
import ChaincodePackage from '../common/nodejs/chaincodePackage.js';
import {discoveryChaincodeInterestBuilder} from '../common/nodejs/serviceDiscovery.js';
import {couchDBIndex} from '../common/nodejs/couchdb.js';
import {ChaincodeType} from '../common/nodejs/formatter/chaincode.js';

const chaincodeConfig = importFrom('../config/chaincode.json', import.meta);

export const prepareInstall = async (chaincodeId, binManager) => {
	const {path: chaincodeRelativePath, type: Type, couchDBIndexes} = chaincodeConfig[chaincodeId];
	const chaincodePath = homeResolve(chaincodeRelativePath);

	if (!Type || Type === ChaincodeType.golang) {
		execSync(`cd ${chaincodePath} && rm -rf vendor && go mod vendor`);
	}

	const chaincodePackage = new ChaincodePackage({
		Path: chaincodePath,
		Type,
		Label: chaincodeId
	});
	const [tmpDir, t1] = createTmpDir();
	const ccPack = path.resolve(tmpDir, 'ccPackage.tar.gz');

	if (Array.isArray(couchDBIndexes)) {
		couchDBIndex(path.resolve(chaincodePath, 'META-INF'), undefined, undefined, ...couchDBIndexes);
	}
	await chaincodePackage.pack(ccPack, binManager);


	return [ccPack, t1];
};
export const install = async (peers, {chaincodeId}, user) => {
	const [ccPack, t1] = await prepareInstall(chaincodeId);
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
export const getEndorsePolicy = (chaincodeId) => {
	const {endorsingConfigs} = chaincodeConfig[chaincodeId];
	if (endorsingConfigs) {
		return buildEndorsePolicy(endorsingConfigs);
	}
};

export const getCollectionConfig = (chaincodeId) => {
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


export const discoveryChaincodeInterestTranslator = (chaincodeIDs) => {
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

