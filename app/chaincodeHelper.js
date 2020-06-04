const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
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
	const [tmpDir, t1] = tmp.createTmpDir({unsafeCleanup: true});
	const ccPack = path.resolve(tmpDir, 'ccPackage.tar.gz');
	await chaincodePackage.pack(chaincodePath, ccPack);


	//TODO metadataPath = path.resolve(chaincodePath, 'META-INF');// the name is arbitrary

	//TODO couchDBIndex(metadataPath, undefined, ...chaincodeConfig[chaincodeId].couchDBIndexes);

	return [ccPack, t1];
};
const install = async (peers, {chaincodeId}, user) => {
	const [ccPack, t1] = await prepareInstall({chaincodeId});
	const chaincodeAction = new ChaincodeAction(peers, user);
	const result = await chaincodeAction.install(ccPack);
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

const buildEndorsePolicy = (chaincodeId) => {
	const config = chaincodeConfig[chaincodeId].endorsingConfigs;
	if (config) {
		const {n} = config;
		const identities = [];
		for (const [mspid, type] of Object.entries(config.mspid)) {
			identities.push({role: {type, mspid}});
		}
		return simplePolicyBuilder(identities, n);
	}
};

const getCollectionConfig = (chaincodeId) => {
	return chaincodeConfig[chaincodeId].collectionsConfig;
};


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



module.exports = {
	buildEndorsePolicy,
	getCollectionConfig,
	install,
};
