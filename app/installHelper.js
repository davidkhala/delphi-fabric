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
	const partialResult = async (peerOrg, peerIndexes) => {
		const package_id = await installs(chaincodeId, peerOrg, peerIndexes);
		packageIDs[peerOrg] = package_id;
	};
	if (channelName) {
		for (const [peerOrg, {peerIndexes}] of Object.entries(globalConfig.channels[channelName].organizations)) {
			await partialResult(peerOrg, peerIndexes);
		}
	} else {
		for (const [peerOrg, {peers}] of Object.entries(globalConfig.organizations)) {
			await partialResult(peerOrg, Object.keys(peers));
		}
	}
	return packageIDs;
};

class ChaincodeDefinitionOperator {
	/**
	 *
	 * @param {string} channelName
	 */
	constructor(channelName) {
		this.channel = helper.prepareChannel(channelName);
		this.waitForConsensus = 1000;
	}

	async approves({sequence, PackageID}, orgName, peers, orderer, gate) {
		const {channel, waitForConsensus} = this;
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
		await chaincodeAction.approve({name, PackageID, sequence}, orderer, waitForConsensus);
	}

	async commitChaincodeDefinition({sequence, name}, orgName, peers, orderer, gate) {
		const {channel} = this;
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
	}

	async checkCommitReadiness({sequence, name}, orgName, peers, gate) {
		const {channel} = this;
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
	}

	async queryDefinition(orgName, peerIndexes, name) {
		const {channel} = this;
		const peers = helper.newPeers(peerIndexes, orgName);
		for (const peer of peers) {
			await peer.connect();
		}
		const user = helper.getOrgAdmin(orgName);
		const chaincodeAction = new ChaincodeAction(peers, user, channel, EndorseALL);
		return await chaincodeAction.queryChaincodeDefinition(name);
	}

	/**
	 *
	 * @param {string} org
	 * @param {string} chaincodeId
	 * @param {number} sequence
	 * @param {Orderer} _orderer
	 * @param {string} [_gate]
	 */
	async queryInstalledAndApprove(org, chaincodeId, sequence, _orderer, _gate) {
		const peers = helper.newPeers([0, 1], org); // TODO use discovery to find more peer
		for (const peer of peers) {
			await peer.connect();

		}
		const user = helper.getOrgAdmin(org);
		const queryHub = new QueryHub(peers, user);
		const queryResult = await queryHub.chaincodesInstalled(chaincodeId);
		let PackageID;
		for (const entry of queryResult) {
			const PackageIDs = Object.keys(entry);
			for (const reference of Object.values(entry)) {
				for (const [channelName, {chaincodes}] of Object.entries(reference)) {
					console.info(channelName, chaincodes);
				}
			}
			if (PackageIDs.length > 1) {
				console.error(queryResult);
				console.error({PackageIDs: PackageIDs});
				throw Error('found multiple installed packageID, could not decide which to approve');

			} else {
				if (PackageID) {
					assert.strictEqual(PackageID, PackageIDs[0]);
				}
				PackageID = PackageIDs[0];
			}
		}
		if (PackageID) {
			await this.approves({PackageID, sequence}, org, peers, _orderer, _gate);
		}

	}
}

module.exports = {
	installs,
	installAll,
	ChaincodeDefinitionOperator
};