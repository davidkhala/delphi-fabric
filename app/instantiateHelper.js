// TODO WIP
const {instantiate, upgrade} = require('./chaincodeHelper');
const helper = require('./helper');
const {nextVersion} = require('../common/nodejs/admin/helper').nodeUtil.version();
const {findLatest} = require('../common/nodejs/chaincodeVersion');
const channelName = 'allchannel';
exports.instantiate = async (clientPeerOrg, peers, chaincodeId, fcn, args = [], transientMap) => {
	const channel = helper.prepareChannel(channelName);
	return instantiate(channel, peers, {fcn, chaincodeId, chaincodeVersion: nextVersion(), args, transientMap});
};
exports.upgrade = async (clientPeerOrg, peers, chaincodeId, chaincodeVersion, fcn, args = []) => {
	const channel = helper.prepareChannel(channelName);
	return upgrade(channel, peers, {fcn, chaincodeId, chaincodeVersion, args});
};

const Query = require('../common/nodejs/query');
exports.upgradeToLatest = async (clientPeerOrg, peer, chaincodeId, fcn, args = []) => {
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const {chaincodes} = await Query.chaincodesInstalled(peer, client);
	const {version} = findLatest(chaincodes, chaincodeId);
	await exports.upgrade(clientPeerOrg, [peer], chaincodeId, version, fcn, args);
};