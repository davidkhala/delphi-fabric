const {install, approve} = require('./chaincodeHelper');
const helper = require('./helper');

const globalConfig = require('../config/orgs.json');
const {channels} = globalConfig;

const channelName = 'allchannel';
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
exports.approves = async (PackageID, orgName, peerIndexes, orderer) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	await orderer.connect();
	const user = helper.getOrgAdmin(orgName);
	const label = PackageID.split(':')[0];
	await approve(peers, {label, PackageID, channelName}, user, orderer);
};
exports.approveAll = async (PackageID, orderer) => {
	for (const [peerOrg, config] of Object.entries(channels[channelName].organizations)) {
		const {peerIndexes} = config;
		const result = await exports.approves(PackageID, peerOrg, peerIndexes, orderer);
	}
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
