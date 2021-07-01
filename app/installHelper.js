const {install, getEndorsePolicy, getCollectionConfig} = require('./chaincodeHelper');
const ChaincodeAction = require('../common/nodejs/chaincodeOperation');
const helper = require('./helper');
const globalConfig = require('../config/orgs.json');
const logger = require('khala-logger/log4js').consoleLogger('install helper');
const {EndorseALL} = require('../common/nodejs/endorseResultInterceptor');
const QueryHub = require('../common/nodejs/query');
const assert = require('assert');
const prepare = ({PackageID}) => {
	const name = PackageID.split(':')[0];
	return {name};
};
// only one time, one org could deploy
const installs = async (chaincodeId, orgName, peerIndexes = Object.keys(globalConfig.organizations[orgName].peers)) => {
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
const installAll = async (chaincodeId, channelName) => {
	const packageIDs = {};
	const installOnOrg = async (peerOrg, peerIndexes) => {
		const package_id = await installs(chaincodeId, peerOrg, peerIndexes);
		packageIDs[peerOrg] = package_id;
	};
	if (channelName) {
		for (const [peerOrg, {peerIndexes}] of Object.entries(globalConfig.channels[channelName].organizations)) {
			await installOnOrg(peerOrg, peerIndexes);
		}
	} else {
		for (const [peerOrg, {peers}] of Object.entries(globalConfig.organizations)) {
			await installOnOrg(peerOrg, Object.keys(peers));
		}
	}
	return packageIDs;
};

class ChaincodeDefinitionOperator {
	/**
	 *
	 * @param {string} channelName
	 * @param {Client.User} admin
	 * @param {Peer[]} peers
	 * @param {boolean} [init_required]
	 */
	constructor(channelName, admin, peers, init_required) {
		const channel = helper.prepareChannel(channelName);
		this.waitForConsensus = 1000;
		const chaincodeAction = new ChaincodeAction(peers, admin, channel, EndorseALL);
		chaincodeAction.setInitRequired(init_required);
		Object.assign(this, {chaincodeAction, peers, admin});
	}

	async approves({sequence, PackageID}, orderer, gate) {
		const {waitForConsensus, peers, chaincodeAction} = this;
		for (const peer of peers) {
			await peer.connect();
		}
		await orderer.connect();
		const {name} = prepare({PackageID});

		const endorsementPolicy = {
			gate
		};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));

		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		await chaincodeAction.approve({name, PackageID, sequence}, orderer, waitForConsensus);
	}

	async commitChaincodeDefinition({sequence, name}, orderer, gate) {
		const {peers, chaincodeAction} = this;
		for (const peer of peers) {
			await peer.connect();
		}
		await orderer.connect();
		const endorsementPolicy = {gate};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));
		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		await chaincodeAction.commitChaincodeDefinition({name, sequence}, orderer);
	}

	async checkCommitReadiness({sequence, name}, gate) {
		const {peers, chaincodeAction} = this;
		for (const peer of peers) {
			await peer.connect();
		}
		const endorsementPolicy = {gate};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));
		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		return await chaincodeAction.checkCommitReadiness({name, sequence});
	}

	async queryDefinition(orgName, peerIndexes, name) {
		const {peers, chaincodeAction} = this;

		for (const peer of peers) {
			await peer.connect();
		}
		return await chaincodeAction.queryChaincodeDefinition(name);
	}

	/**
	 *
	 * @param {string} chaincodeId
	 * @param {number} sequence
	 * @param {Orderer} _orderer
	 * @param {string} [_gate]
	 */
	async queryInstalledAndApprove(chaincodeId, sequence, _orderer, _gate) {

		const {peers, admin} = this;
		for (const peer of peers) {
			await peer.connect();
		}
		const queryHub = new QueryHub(peers, admin);
		const queryResult = await queryHub.chaincodesInstalled(chaincodeId);
		let PackageID;
		for (const entry of queryResult) {
			const PackageIDs = Object.keys(entry);
			for (const reference of Object.values(entry)) {
				for (const [channelName, {chaincodes}] of Object.entries(reference)) {
					logger.info(channelName, chaincodes);
				}
			}
			if (PackageIDs.length > 1) {
				logger.error(queryResult);
				logger.error({PackageIDs: PackageIDs});
				throw Error('found multiple installed packageID, could not decide which to approve');

			} else {
				if (PackageID) {
					assert.strictEqual(PackageID, PackageIDs[0]);
				}
				PackageID = PackageIDs[0];
			}
		}
		if (PackageID) {
			await this.approves({PackageID, sequence}, _orderer, _gate);
		}

	}
}

module.exports = {
	installs,
	installAll,
	ChaincodeDefinitionOperator
};