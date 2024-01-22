import assert from 'assert';
import {importFrom} from '@davidkhala/light/es6.mjs';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {install, getEndorsePolicy, getCollectionConfig} from './chaincodeHelper.js';
import ChaincodeAction from '../common/nodejs/chaincodeOperation.js';
import {parsePackageID} from '../common/nodejs/formatter/chaincode.js';
import * as helper from './helper.js';
import QueryHub from '../common/nodejs/query.js';
import Transaction from '../common/nodejs/transaction.js';
import {isEven} from '@davidkhala/light/array.js';
import * as util from 'util';

const globalConfig = importFrom(import.meta, '../config/orgs.json');
const logger = consoleLogger('install helper');

// only one time, one org could deploy
export const installs = async (chaincodeId, orgName, peerIndexes = Object.keys(globalConfig.organizations[orgName].peers)) => {
	const peers = helper.newPeers(peerIndexes, orgName);
	for (const peer of peers) {
		await peer.connect();
	}
	const user = helper.getOrgAdmin(orgName);
	const [result, t1] = await install(peers, {chaincodeId}, user);
	const ids = result.responses.map(({response}) => response.package_id);
	assert.ok(isEven(ids));
	const packageID = ids[0];
	t1();
	for (const peer of peers) {
		peer.disconnect();
	}
	return packageID;
};
export const installAll = async (chaincodeId, channelName) => {
	let package_id_already;
	const installOnOrg = async (peerOrg, peerIndexes) => {
		const package_id = await installs(chaincodeId, peerOrg, peerIndexes);
		if (package_id_already) {
			assert.strictEqual(package_id, package_id_already);
		} else {
			package_id_already = package_id;
		}

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
	return package_id_already;
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
		const chaincodeAction = new ChaincodeAction(peers, admin, channel, logger);
		chaincodeAction.init_required = !!init_required;
		this.forceUpgrade = true;
		Object.assign(this, {chaincodeAction, peers, admin, channel, channelName});

	}

	async init(chaincodeId, orderer) {
		if (!orderer) {
			const orderers = helper.newOrderers();
			orderer = orderers[0];
		}
		const tx = new Transaction(this.peers, this.admin, this.channel, chaincodeId, logger);
		await tx.submit({init: true}, orderer);
	}

	async approves({sequence, package_id}, orderer, gate) {
		const {waitForConsensus, chaincodeAction} = this;

		await orderer.connect();

		const {name} = parsePackageID(package_id);

		const endorsementPolicy = {
			gate
		};
		Object.assign(endorsementPolicy, getEndorsePolicy(name));

		chaincodeAction.setEndorsementPolicy(endorsementPolicy);
		chaincodeAction.setCollectionsConfig(getCollectionConfig(name));
		try {
			await chaincodeAction.approve({name, package_id, sequence}, orderer, waitForConsensus);
		} finally {
			orderer.disconnect();
		}
	}

	/**
	 *
	 * @param sequence
	 * @param name
	 * @param orderer
	 * @param [gate]
	 */
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
		const readyStates = await chaincodeAction.checkCommitReadiness({name, sequence});
		assert.ok(isEven(readyStates), `CommitReadiness should be even, but got ${util.inspect(readyStates)}`);
		return readyStates[0];
	}

	async queryDefinition(chaincodeID) {
		const {chaincodeAction} = this;
		const results = await chaincodeAction.queryChaincodeDefinition(chaincodeID);
		if (results) {
			results.every(e => assert.deepEqual(e, results[0]));
			return results[0];
		}

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

	async queryInstalled(label) {
		const {peers, admin} = this;

		const queryHub = new QueryHub(peers, admin);
		const queryResults = await queryHub.chaincodesInstalled(label);
		assert.ok(isEven(queryResults), 'chaincodesInstalled results should be even');
		const queryResult = queryResults[0];

		const uncommitted = [], committed = [];
		for (const [package_id, moreInfo] of Object.entries(queryResult)) {
			if (Object.keys(moreInfo).length === 0) {
				logger.info(package_id, 'installed while not committed');
				uncommitted.push(package_id);
			} else {

				for (const [channelName, {chaincodes}] of Object.entries(moreInfo)) {
					if (channelName === this.channelName) {
						for (const {name, version} of chaincodes) {
							assert.strictEqual(name, label);
							committed.push({package_id, version});
						}
					}
				}
			}
		}

		return [queryResult, uncommitted, committed];
	}

	async queryAndCommit(chaincodeID, orderer) {
		const isCommitted = await this.queryDefinition(chaincodeID);

		let sequence = 1;
		if (isCommitted) {
			sequence = isCommitted.sequence + 1;
		}
		await this.commitChaincodeDefinition({name: chaincodeID, sequence}, orderer);

	}

	/**
	 *
	 * @param {string} chaincodeId
	 * @param {Orderer} _orderer
	 * @param {string} [_gate]
	 */
	async queryInstalledAndApprove(chaincodeId, _orderer, _gate) {

		const [_, uncommitted, committed] = await this.queryInstalled(chaincodeId);

		const isCommitted = await this.queryDefinition(chaincodeId);

		let sequence = 1;
		if (isCommitted) {
			sequence = isCommitted.sequence + 1;
		}
		for (const package_id of uncommitted) {
			await this.approves({package_id, sequence}, _orderer, _gate);
		}
		if (uncommitted.length === 0 && this.forceUpgrade) {
			// force update
			for (const package_id of committed.map(({package_id}) => package_id)) {
				await this.approves({package_id, sequence}, _orderer, _gate);
			}
		}

	}
}
