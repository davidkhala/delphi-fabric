const helper = require('./helper');
const globalConfig = require('../config/orgs.json');
const logger = require('../common/nodejs/logger').new('test increment install');
const {incrementInstall, upgrade} = require('../common/nodejs/chaincodeVersion');
const {prepareInstall} = require('./chaincodeHelper');
const chaincodeId = process.env.name ? process.env.name : 'stress';

const channelName = 'allchannel';
const updateInstallAll = async () => {
	const orgsConfig = globalConfig.channels[channelName].orgs;
	for (const orgName in orgsConfig) {
		const {peerIndexes} = orgsConfig[orgName];
		const client = await helper.getOrgAdmin(orgName);
		const peers = helper.newPeers(peerIndexes, orgName);
		for (const peer of peers) {
			const opt = await prepareInstall({chaincodeId});
			await incrementInstall(peer, opt, client);
		}
	}

};

const task = async () => {
	await updateInstallAll();
};
task();


