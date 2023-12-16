import {createTmpDir} from '@davidkhala/nodeutils/tmp.js';
import path from 'path';
import {homeResolve} from '@davidkhala/light/path.js';
import {execSync} from '@davidkhala/light/devOps.js';
import {filedirname, importFrom} from '@davidkhala/light/es6.mjs';
import ChaincodeAction from '../common/nodejs/chaincodeOperation.js';
import ChaincodePackage from '../common/nodejs/chaincodePackage.js';
import {discoveryChaincodeInterestBuilder} from '../common/nodejs/serviceDiscovery.js';
import {couchDBIndex} from '../common/nodejs/couchdb.js';
import {ChaincodeType} from '../common/nodejs/formatter/chaincode.js';
import BinManager from '../common/nodejs/binManager/binManager.js';

filedirname(import.meta);
const chaincodeConfig = importFrom(import.meta, '../config/chaincode.json');

/**
 *
 * @param chaincodeId
 * @param [binManager]
 * @param [outputDir]
 * @returns {(string|(function(...[*]=)))[]}
 */
export const prepareInstall = (chaincodeId, binManager, outputDir) => {
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
	let cleanup;
	if (!outputDir) {
		const [tmpDir, t1] = createTmpDir();
		outputDir = tmpDir;
		cleanup = t1;
	}
	const ccPack = path.resolve(outputDir, chaincodeId + '.ccPackage.tar.gz');

	if (Array.isArray(couchDBIndexes)) {
		couchDBIndex(path.resolve(chaincodePath, 'META-INF'), undefined, undefined, ...couchDBIndexes);
	}
	const packageid = chaincodePackage.pack(ccPack, binManager);

	return [ccPack, packageid, cleanup];
};
export const install = async (peers, {chaincodeId}, user) => {
	const binPath = path.resolve(__dirname, '../common/bin');
	const binManager = new BinManager(binPath);
	const [ccPack, packageId, cleanup] = prepareInstall(chaincodeId, binManager);
	const chaincodeAction = new ChaincodeAction(peers, user);
	const result = await chaincodeAction.install(ccPack);
	return [result, cleanup];
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

