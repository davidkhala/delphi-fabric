const {install} = require('./chaincodeHelper');
const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
const helper = require('./helper');
const {emptyChannel} = require('../common/nodejs/admin/channel')
const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;

const channelName = 'allchannel';
const channel = emptyChannel(channelName)
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
	t1();
	return result;
};
exports.approves = async ({sequence, PackageID}, orgName, peers, orderer) => {
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const {name} = prepare({PackageID});
	const chaincodeAction = new ChaincodeAction(peers, user, channel);
	await chaincodeAction.approve({name, PackageID, sequence}, orderer);
};
exports.commitChaincodeDefinition = async ({sequence, PackageID}, orgName, peers, orderer) => {
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const {name} = prepare({PackageID});
	const chaincodeAction = new ChaincodeAction(peers, user, channel);
	await chaincodeAction.commitChaincodeDefinition({name, sequence}, orderer);
};

exports.checkCommitReadiness = async ({sequence, PackageID}, orgName, peers) => {
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const {name} = prepare({PackageID});

	const chaincodeAction = new ChaincodeAction(peers, user, channel);
	await chaincodeAction.checkCommitReadiness({name, sequence});
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
	let packageID;
	for (const [peerOrg, config] of Object.entries(channels[channelName].organizations)) {
		const {peerIndexes} = config;
		const result = await exports.installs(chaincodeId, peerOrg, peerIndexes);
		packageID = result.responses[0].response.package_id;
	}

	return packageID;
};
