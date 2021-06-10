const ChaincodeHelper = require('./chaincodeHelper');
const Context = require('./index');
const {incrementInstall} = require('khala-fabric-sdk-node/chaincodeVersion');

class InstallHelper {
	constructor(globalConfig, chaincodeConfig, binManager, logger = console) {
		this.channelsConfig = globalConfig.channels;
		this.context = new Context(globalConfig);
		this.chaincodeHelper = new ChaincodeHelper(chaincodeConfig);
		Object.assign(this, {binManager, logger});
	}

	// only one time, one org could deploy
	async installs(chaincodeId, orgName, peerIndexes) {
		const peers = this.context.newPeers(peerIndexes, orgName);
		const client = this.context.getOrgAdmin(orgName);
		const chaincodeVersion = '0.0.0';

		const {binManager} = this;
		let result;
		if (binManager) {
			result = await this.chaincodeHelper.install(peers, {chaincodeId, chaincodeVersion}, client, {
				orgName,
				globalConfig: this.context.globalConfig,
				binManager
			});
		} else {
			result = await this.chaincodeHelper.install(peers, {chaincodeId, chaincodeVersion}, client);
		}
		this.logger.debug('installs result', result);
		return result;

	}

	async installAll(chaincodeId, channelName) {

		for (const [peerOrg, config] of Object.entries(this.channelsConfig[channelName].organizations)) {
			const {peerIndexes} = config;
			await this.installs(chaincodeId, peerOrg, peerIndexes);

		}
	}


	// TODO
	async incrementInstalls(chaincodeId, orgName, peerIndexes) {
		const client = this.context.getOrgAdmin(orgName);
		const peers = this.context.newPeers(peerIndexes, orgName);
		const opt = await this.chaincodeHelper.prepareInstall({chaincodeId});
		await incrementInstall(peers, opt, client);
	}

	// TODO
	async incrementInstallAll(chaincodeId, channelName) {
		const orgsConfig = this.channelsConfig[channelName].organizations;
		for (const orgName in orgsConfig) {
			const {peerIndexes} = orgsConfig[orgName];
			await this.incrementInstalls(chaincodeId, orgName, peerIndexes);
		}
	}

}

module.exports = InstallHelper;


