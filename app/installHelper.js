import assert from 'assert';
import {importFrom} from '@davidkhala/light/es6.mjs';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {install, getEndorsePolicy, getCollectionConfig} from './chaincodeHelper.js';
import ChaincodeAction from '../common/nodejs/chaincodeOperation.js';
import {parsePackageID} from '../common/nodejs/formatter/chaincode.js';
import * as helper from './helper.js';
import QueryHub from '../common/nodejs/query.js';
import Transaction from '../common/nodejs/transaction.js';

const globalConfig = importFrom('../config/orgs.json', import.meta);
const logger = consoleLogger('install helper');

// only one time, one org could deploy
export const installs = async (chaincodeId, orgName, peerIndexes = Object.keys(globalConfig.organizations[orgName].peers)) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const [result, t1] = await install(peers, {chaincodeId}, user);
	const packageID = result.responses[0].response.package_id;
	t1();
	for (const peer of peers) {
		peer.disconnect();
	}
	return packageID;
};
export const installAll = async (chaincodeId, channelName) => {
	const packageIDs = {};
	const installOnOrg = async (peerOrg, peerIndexes) => {
		const package_id = await installs(chaincodeId, peerOrg, peerIndexes);
		packageIDs[peerOrg] = package_id;
	};
	if (channelName) {
		for (const [peerOrg, {peerIndexes}] of Object.entries(globalConfig.channels[channelName].organizations)) {
			await installOnOrg(peerOrg, peerIndexes);
			logger.info('[DONE] installOnOrg', peerOrg);
		}
	} else {
		for (const [peerOrg, {peers}] of Object.entries(globalConfig.organizations)) {
			await installOnOrg(peerOrg, Object.keys(peers));
			logger.info('[DONE] installOnOrg', peerOrg);
		}
	}
	return packageIDs;
};

export class ChaincodeDefinitionOperator {
	/**
	 *
	 * @param {string} channelName
	 * @param {User} admin Client.User
	 * @param {Peer[]} peers
	 * @param {boolean} [init_required]
	 */
	constructor(channelName, admin, peers, init_required) {
		const channel = helper.prepareChannel(channelName);
		this.waitForConsensus = 1000;
		const chaincodeAction = new ChaincodeAction(peers, admin, channel);
		chaincodeAction.init_required = !!init_required;
		Object.assign(this, {chaincodeAction, peers, admin, channel});
	}

	async init(chaincodeId, orderer) {
		if (!orderer) {
			const orderers = helper.newOrderers();
			orderer = orderers[0];
		}
		const tx = new Transaction(this.peers, this.admin, this.channel, chaincodeId, logger);
		await tx.submit({init: true}, orderer);
	}

	async approves({sequence, PackageID}, orderer, gate) {
		const {waitForConsensus, chaincodeAction} = this;

		await orderer.connect();

		const {name} = parsePackageID(PackageID);

		const endorsementPolicy = {
			gate
		};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));

		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		logger.debug(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		try {
			await chaincodeAction.approve({name, PackageID, sequence}, orderer, waitForConsensus);
		} finally {
			orderer.disconnect();
		}
	}

	async commitChaincodeDefinition({sequence, name}, orderer, gate) {
		const {chaincodeAction} = this;
		await orderer.connect();
		const endorsementPolicy = {gate};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));
		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		try {
			await chaincodeAction.commitChaincodeDefinition({name, sequence}, orderer);
		} finally {
			orderer.disconnect();
		}

	}

	async checkCommitReadiness({sequence, name}, gate) {
		const {chaincodeAction} = this;

		const endorsementPolicy = {gate};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));
		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		return await chaincodeAction.checkCommitReadiness({name, sequence});
	}

	async queryDefinition(name) {
		const {chaincodeAction} = this;
		return await chaincodeAction.queryChaincodeDefinition(name);
	}

	async connect() {
		const {peers} = this;
		for (const peer of peers) {
			await peer.connect();
		}
	}

	disconnect() {
		const {peers} = this;
		for (const peer of peers) {
			peer.disconnect();
		}
	}

	async queryInstalled(label, packageId) {
		const {peers, admin} = this;
		if (packageId && !label) {
			label = parsePackageID(packageId).label;
		}
		const queryHub = new QueryHub(peers, admin);
		const queryResult = await queryHub.chaincodesInstalled(label, packageId);
		for (const entry of queryResult) {
			const PackageIDs = Object.keys(entry);
			if (packageId) {
				assert.strictEqual(packageId, PackageIDs[0]);
				assert.ok(PackageIDs.length === 1);
			}
			for (const [_packageid, moreInfo] of Object.entries(entry)) {
				if (Object.keys(moreInfo).length === 0) {
					logger.info(_packageid, 'installed while not deployed');
				} else {
					for (const [channelName, {chaincodes}] of Object.entries(moreInfo)) {
						for (const {name, version} of chaincodes) {
							assert.strictEqual(name, label);
							logger.info(_packageid, channelName, {version});
						}

					}
				}

			}

		}
		return queryResult;
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

		const queryHub = new QueryHub(peers, admin);
		const queryResult = await queryHub.chaincodesInstalled(chaincodeId);
		let PackageID;
		for (const entry of queryResult) {
			const PackageIDs = Object.keys(entry);
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
