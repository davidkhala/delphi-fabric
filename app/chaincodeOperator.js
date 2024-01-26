import assert from 'assert';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {install, getEndorsePolicy, getCollectionConfig} from './chaincodeHelper.js';
import ChaincodeAction from '../common/nodejs/chaincodeOperation.js';
import {parsePackageID} from '../common/nodejs/formatter/chaincode.js';
import * as helper from './helper.js';
import QueryHub from '../common/nodejs/query.js';
import Transaction from '../common/nodejs/transaction.js';
import {isEven} from '@davidkhala/light/array.js';
import * as util from 'util';

const logger = consoleLogger('chaincode operator');

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

	async install(chaincodeId) {
		const package_id = await install(this.peers, chaincodeId, this.admin);
		logger.info(`${package_id} installed to peers ${this.peers.map(peer => peer.toString())}`);
		return package_id;
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
			assert.ok(isEven(results));
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
		assert.ok(isEven(queryResults), `ChaincodesInstalled should be even, but got ${util.inspect(queryResults)}`);

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
		assert.ok(committed.length < 2, 'committed contract should not be more than 1');
		return [queryResult, uncommitted, committed[0]];
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
	 * @param {string} uncommitted_packageId
	 * @param {string} [_gate]
	 */
	async queryInstalledAndApprove(chaincodeId, _orderer, uncommitted_packageId, _gate) {

		const [_, uncommitted, committed] = await this.queryInstalled(chaincodeId);

		const isCommitted = await this.queryDefinition(chaincodeId);

		let sequence = 1;
		if (isCommitted) {
			sequence = isCommitted.sequence + 1;
		}
		let package_id;
		if (uncommitted.includes(uncommitted_packageId)) {
			package_id = uncommitted_packageId;
		} else if (committed && committed.package_id === uncommitted_packageId) {
			if (this.forceUpgrade) {
				package_id = uncommitted_packageId;
			} else {
				return;
			}
		} else {
			throw Error(`package ${uncommitted_packageId} not found within chaincode=${chaincodeId} namespace`);
		}

		await this.approves({package_id, sequence}, _orderer, _gate);

	}
}
