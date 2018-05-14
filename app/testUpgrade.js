const Upgrade = require('./instantiate-chaincode').upgrade;
const helper = require('./helper');
const globalConfig = require('../config/orgs.json');
const logger = require('../common/nodejs/logger').new('testUpgrade');
const Query = require('../common/nodejs/query');
const chaincodeUtil = require('../common/nodejs/chaincode');

const chaincodeId = 'adminChaincode';

const args = [];

const channelName = 'allchannel';
const UpdateInstall = require('./install-chaincode').updateInstall;
const updateInstallAll = async () => {
	const orgsConfig = globalConfig.channels[channelName].orgs;
	for (const orgName in orgsConfig) {
		const {peerIndexes} = orgsConfig[orgName];
		const client = await helper.getOrgAdmin(orgName);
		const peers = helper.newPeers(peerIndexes, orgName);
		await UpdateInstall(peers, {chaincodeId}, client);
	}

};

const doTest = async () => {
	let orgName = 'PM.Delphi.com';
	let client = await helper.getOrgAdmin(orgName);
	let peers = helper.newPeers([0], orgName)[0];
	let channel = helper.prepareChannel(channelName, client, true);
	const {chaincodes} = await Query.chaincodes.instantiated(peers, channel);
	const foundChaincode = chaincodes.find((element) => {
		return element.name === chaincodeId;
	});
	if (!foundChaincode) {
		logger.error(chaincodeId, 'not found');
		return;
	}
	await updateInstallAll(foundChaincode);


	const chaincodeVersion = chaincodeUtil.nextVersion(foundChaincode.version);
	orgName = 'BU.Delphi.com';
	client = await helper.getOrgAdmin(orgName);
	channel = helper.prepareChannel(channelName, client, true);
	peers = helper.newPeers([0], orgName);
	return await Upgrade(channel, peers, {chaincodeId, chaincodeVersion, args});
	//	NOTE: found all peers in channel will create chaincode container with new version for each, but the old version chaincode container remains
};
doTest();


