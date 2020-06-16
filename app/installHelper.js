const {install, getEndorsePolicy, getCollectionConfig} = require('./chaincodeHelper');
const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
const helper = require('./helper');
const {emptyChannel} = require('../common/nodejs/admin/channel');
const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;
const logger = require('khala-logger/log4js').consoleLogger('install helper');
const {EndorseALL} = require('../common/nodejs/endorseResultInterceptor');
const channelName = 'allchannel';
const channel = emptyChannel(channelName);
const prepare = ({PackageID}) => {
	const name = PackageID.split(':')[0];
	return {name};
};
// only one time, one org could deploy
exports.installs = async (chaincodeId, orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const [result, t1] = await install(peers, {chaincodeId}, user);
	const packageID = result.responses[0].response.package_id;
	t1();
	return packageID;
};
exports.approves = async ({sequence, PackageID}, orgName, peers, orderer, gate) => {
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const {name} = prepare({PackageID});
	const chaincodeAction = new ChaincodeAction(peers, user, channel, EndorseALL);
	chaincodeAction.setInitRequired(true);
	const endorsementPolicy = {
		gate
	};
	Object.assign(endorsementPolicy, getEndorsePolicy(name));

	chaincodeAction.setEndorsementPolicy(endorsementPolicy);
	chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
	await chaincodeAction.approve({name, PackageID, sequence}, orderer);
};
exports.commitChaincodeDefinition = async ({sequence, name}, orgName, peers, orderer, gate) => {
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const chaincodeAction = new ChaincodeAction(peers, user, channel, EndorseALL);
	chaincodeAction.setInitRequired(true);
	const endorsementPolicy = {gate};
	Object.assign(endorsementPolicy, getEndorsePolicy(name));
	chaincodeAction.setEndorsementPolicy(endorsementPolicy);
	chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
	await chaincodeAction.commitChaincodeDefinition({name, sequence}, orderer);
};

exports.checkCommitReadiness = async ({sequence, name}, orgName, peers, gate) => {
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);

	const chaincodeAction = new ChaincodeAction(peers, user, channel, EndorseALL, logger);
	const endorsementPolicy = {gate};
	Object.assign(endorsementPolicy, getEndorsePolicy(name));
	chaincodeAction.setEndorsementPolicy(endorsementPolicy);
	chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
	return await chaincodeAction.checkCommitReadiness({name, sequence});
};
exports.queryDefinition = async (orgName, peerIndexes, name) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const chaincodeAction = new ChaincodeAction(peers, user, channel, EndorseALL);
	return await chaincodeAction.queryChaincodeDefinition(name);
};

exports.installAll = async (chaincodeId) => {
	const packageIDs = {};
	for (const [peerOrg, config] of Object.entries(channels[channelName].organizations)) {
		const {peerIndexes} = config;
		const package_id = await exports.installs(chaincodeId, peerOrg, peerIndexes);
		packageIDs[peerOrg] = package_id;
	}

	return packageIDs;
};
