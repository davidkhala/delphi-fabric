import path from 'path';
import assert from 'assert';

import {consoleLogger} from '@davidkhala/logger/log4.js';
import {sleep} from '@davidkhala/light/index.js';
import {homeResolve} from "@davidkhala/light/path.js";
import {axiosPromise} from '@davidkhala/axios/index.js';
import {importFrom, filedirname} from '@davidkhala/light/es6.mjs';
import {setAnchorPeersByOrg} from './channelHelper.js';
import * as helper from './helper.js';
import BinManager from '../common/nodejs/binManager/binManager.js';
import Orderer from '../common/nodejs/admin/orderer.js';
import {getGenesisBlock} from '../common/nodejs/channel.js';
import QueryHub from '../common/nodejs/query.js';
import {Status} from '../common/nodejs/formatter/constants.js';
import {DeliverResponseType} from '../common/nodejs/formatter/eventHub.js';

filedirname(import.meta);
const globalConfig = importFrom(import.meta, '../config/orgs.json');
const binPath = process.env.binPath || path.resolve(__dirname, '../common/bin/');
const {join: joinOrderer} = Orderer;
const channelsConfig = globalConfig.channels;

const logger = consoleLogger('channel setup');
const channelName = process.env.channelName || 'allchannel';
describe('channelSetup', function () {
	this.timeout(0);

	it('generate Block', async () => {
		const channelConfig = channelsConfig[channelName];
		const channelBlock = homeResolve(channelConfig.file);

		const binManager = new BinManager(binPath);

		const configtxFile = helper.projectResolve('config', 'configtx.yaml');
		await binManager.configtxgen(channelName, configtxFile, channelName).genBlock(channelBlock);
	});


	it('join Orderer', async () => {
		// params
		const channelConfig = globalConfig.channels[channelName];
		const blockFile = homeResolve(channelConfig.file);

		// end params

		for (const ordererOrgName of Object.keys(globalConfig.orderer.organizations)) {
			const orderers = helper.newOrderers(ordererOrgName);

			for (const orderer of orderers) {
				const {clientKey, tlsCaCert, clientCert, adminAddress} = orderer;

				await joinOrderer(adminAddress, channelName, blockFile, axiosPromise, globalConfig.TLS ? {
					clientKey,
					tlsCaCert,
					clientCert
				} : undefined);

			}
		}

	});
	it('To make raft make consensus, do check after all orderer joined', async () => {
		const channel = helper.prepareChannel(channelName);
		for (const ordererOrgName of Object.keys(globalConfig.orderer.organizations)) {
			const orderers = helper.newOrderers(ordererOrgName);

			for (const orderer of orderers) {
				const user = helper.getOrgAdmin(ordererOrgName, 'orderer');
				await orderer.connect();
				const waitForGenesisBlock = async () => {
					try {
						await getGenesisBlock(channel, user, orderer);
					} catch (e) {
						const {status, Type} = e;
						if (status === Status.SERVICE_UNAVAILABLE && Type === DeliverResponseType.STATUS) {
							logger.warn(orderer.toString(), {status, Type});
							await sleep(1000);
							await waitForGenesisBlock();
						} else {
							throw e;
						}
					}
				};
				await waitForGenesisBlock();
			}
		}
	});
	it('join peers', async () => {
		// params
		const channelConfig = globalConfig.channels[channelName];
		const blockFile = homeResolve(channelConfig.file);
		const channel = helper.prepareChannel(channelName);
		// end params
		//
		for (const [orgName, {peerIndexes}] of Object.entries(channelConfig.organizations)) {
			const peers = helper.newPeers(peerIndexes, orgName);
			const user = helper.getOrgAdmin(orgName);
			const queryHub = new QueryHub(peers, user);
			await queryHub.connect();
			if (binPath) {
				await queryHub.joinWithFile(blockFile, channelName);
			} else {
				const orderers = helper.newOrderers();
				const orderer = orderers[0];
				await orderer.connect();
				await queryHub.joinWithFetch(channel, orderer, user);
				await orderer.disconnect();
			}

			await queryHub.disconnect();

		}
	});
	it('query channel Joined', async () => {
		const channelConfig = globalConfig.channels[channelName];
		for (const [orgName, {peerIndexes}] of Object.entries(channelConfig.organizations)) {
			const peers = helper.newPeers(peerIndexes, orgName);

			const user = helper.getOrgAdmin(orgName);

			const queryHub = new QueryHub(peers, user);
			await queryHub.connect();

			const JoinedResult = await queryHub.channelJoined();
			for (const [index, peer] of Object.entries(peers)) {
				logger.info(peer.toString(), 'has joined', JoinedResult[index]);
				assert.ok(JoinedResult[index].includes(channelName));
			}
			await queryHub.disconnect();

		}
	});

});

describe('anchor peer', async function () {
	this.timeout(0);
	it('setup anchor peer', async () => {

		const channelConfig = globalConfig.channels[channelName];

		const orderers = helper.newOrderers();
		const orderer = orderers[0];
		await orderer.connect();
		for (const org in channelConfig.organizations) {
			await setAnchorPeersByOrg(channelName, org, orderer, binPath);
		}
		await orderer.disconnect();
	});
});






