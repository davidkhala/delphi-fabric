import {setAnchorPeersByOrg} from './channelHelper.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';

import * as helper from './helper.js';
import path from 'path';
import BinManager from '../common/nodejs/binManager.js';
import {homeResolve, sleep} from '@davidkhala/light/index.js';
import Orderer from '../common/nodejs/admin/orderer.js';
import {axiosPromise} from 'khala-axios';
import {getGenesisBlock, join as joinPeer} from '../common/nodejs/channel.js';
import assert from 'assert';
import QueryHub from '../common/nodejs/query.js';
import {Status} from '../common/nodejs/formatter/constants.js';
import {DeliverResponseType} from '../common/nodejs/formatter/eventHub.js';
import {importFrom, filedirname} from '@davidkhala/light/es6.mjs';

filedirname(import.meta);
const globalConfig = importFrom('../config/orgs.json', import.meta);
const binPath = process.env.binPath || path.resolve(__dirname, '../model/bin/');
const {join: joinOrderer} = Orderer;
const channelsConfig = globalConfig.channels;

const logger = consoleLogger('channel setup');
describe('channelSetup', function () {
	this.timeout(0);
	const channelName = process.env.channelName || 'allchannel';
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
				const {clientKey, tlsCaCert, clientCert} = orderer;

				await joinOrderer(orderer.adminAddress, channelName, blockFile, axiosPromise, globalConfig.TLS ? {
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
						logger.warn(e);
						const {status, Type} = e;
						assert.strictEqual(status, Status.SERVICE_UNAVAILABLE);
						assert.strictEqual(Type, DeliverResponseType.STATUS);
						logger.warn(orderer.toString(), {status, Type});
						await sleep(1000);
						await waitForGenesisBlock();
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

			// FIXME, not work yet
			try {
				await joinPeer(channel, peers, user, blockFile);
				//	{ status: 500, message: "channel 'allchannel' not found" }
			} catch (e) {
				logger.error(e);
				throw e;
			}


			const queryHub = new QueryHub(peers, user);
			let JoinedResult;
			try {
				JoinedResult = await queryHub.channelJoined();
			} catch (e) {
				logger.error(e);
			}

			for (const [index, peer] of Object.entries(peers)) {
				logger.info(peer.toString(), 'has joined', JoinedResult[index]);
				assert.ok(JoinedResult[index].includes(channelName));
			}

		}
	});
	it('query channel Joined');
	it('setup anchor peer', async () => {

		if (!process.env.anchor) {
			logger.warn('it skipped due to unspecified process.env.anchor');
			return;
		}
		const peers = helper.allPeers();

		await sleep(2000 * peers.length);
		if (!process.env.binPath) {
			process.env.binPath = path.resolve(__dirname, '../model/bin/');
		}

		const channelConfig = globalConfig.channels[channelName];

		const orderers = helper.newOrderers();
		const orderer = orderers[0];
		await orderer.connect();
		for (const org in channelConfig.organizations) {
			await setAnchorPeersByOrg(channelName, org, orderer, process.env.finalityRequired);
		}
	});
});







