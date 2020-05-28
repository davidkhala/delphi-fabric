const {install, buildEndorsePolicy} = require('./chaincodeHelper');
const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
const helper = require('./helper');
const {emptyChannel} = require('../common/nodejs/admin/channel');
const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;
const logger = require('khala-logger/log4js').consoleLogger('install helper');
const {chaincodesInstalled} = require('../common/nodejs/query');
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
	const queryResult = await chaincodesInstalled(peers, user, packageID);
	if (!packageID) {
		logger.debug('chaincodesInstalled', queryResult);
	} else {
		result.package_id = packageID;
		logger.debug('chaincodeInstalled', packageID, '->', queryResult);
	}

	t1();
	return result;
};
exports.approves = async ({sequence, PackageID}, orgName, peers, orderer, gate) => {
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const {name} = prepare({PackageID});
	const chaincodeAction = new ChaincodeAction(peers, user, channel);
	let json;
	if (!gate) {
		json = buildEndorsePolicy(name);
	}
	await chaincodeAction.approve({name, PackageID, sequence}, orderer, {json, gate});
};
exports.commitChaincodeDefinition = async ({sequence, name}, orgName, peers, orderer, gate) => {
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const chaincodeAction = new ChaincodeAction(peers, user, channel);
	let json;
	if (!gate) {
		json = buildEndorsePolicy(name);
	}
	await chaincodeAction.commitChaincodeDefinition({name, sequence}, orderer, {json, gate});
};

exports.checkCommitReadiness = async ({sequence, name}, orgName, peers, gate) => {
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);

	const chaincodeAction = new ChaincodeAction(peers, user, channel, logger);
	let json;
	if (!gate) {
		json = buildEndorsePolicy(name);
	}
	await chaincodeAction.checkCommitReadiness({name, sequence}, {json, gate});
};
exports.queryDefinition = async (orgName, peerIndexes, name) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const chaincodeAction = new ChaincodeAction(peers, user, channel);
	await chaincodeAction.queryChaincodeDefinition(name);
};

exports.installAll = async (chaincodeId) => {
	const packageIDs = {};
	for (const [peerOrg, config] of Object.entries(channels[channelName].organizations)) {
		const {peerIndexes} = config;
		const {package_id} = await exports.installs(chaincodeId, peerOrg, peerIndexes);
		packageIDs[peerOrg] = package_id;
	}

	return packageIDs;
};
