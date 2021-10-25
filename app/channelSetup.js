const {setAnchorPeersByOrg} = require('./channelHelper');
const logger = require('khala-logger/log4js').consoleLogger('channel setup');
const helper = require('./helper');
const path = require('path');
const globalConfig = require('../config/orgs.json');
const BinManager = require('../common/nodejs/binManager');
const {homeResolve, sleep} = require('khala-light-util');
const {join: joinOrderer} = require('../common/nodejs/admin/orderer');
const {axiosPromise} = require('khala-axios');
const {getGenesisBlock, join: joinPeer} = require('../common/nodejs/channel');
const assert = require('assert');
const QueryHub = require('../common/nodejs/query');
const binPath = process.env.binPath || path.resolve(__dirname, '../common/bin/');

const channelsConfig = globalConfig.channels;

const {Status: {SERVICE_UNAVAILABLE}} = require('../common/nodejs/formatter/constants');
const {DeliverResponseType: {STATUS}} = require('../common/nodejs/formatter/eventHub');

describe('channelSetup', () => {
	const channelName = process.env.channelName || 'allchannel';
	it('generate Block', async function () {
		this.timeout(0);
		const channelConfig = channelsConfig[channelName];
		const channelBlock = homeResolve(channelConfig.file);

		const binManager = new BinManager(binPath);

		const configtxFile = helper.projectResolve('config', 'configtx.yaml');
		await binManager.configtxgen(channelName, configtxFile, channelName).genBlock(channelBlock);
	});
	it('join', async function () {
		this.timeout(0);
		const channelConfig = globalConfig.channels[channelName];

		const blockFile = homeResolve(channelConfig.file);
		const channel = helper.prepareChannel(channelName);
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

		// to make raft make consensus, do check after all joined
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
						assert.strictEqual(status, SERVICE_UNAVAILABLE);
						assert.strictEqual(Type, STATUS);
						logger.warn(orderer.toString(), {status, Type});
						await sleep(1000);
						await waitForGenesisBlock();
					}
				};
				await waitForGenesisBlock();
			}
		}


		for (const [orgName, {peerIndexes}] of Object.entries(channelConfig.organizations)) {
			const peers = helper.newPeers(peerIndexes, orgName);
			const user = helper.getOrgAdmin(orgName);

			await joinPeer(channel, peers, user, blockFile);
			const queryHub = new QueryHub(peers, user);
			const JoinedResult = await queryHub.channelJoined();
			for (const [index, peer] of Object.entries(peers)) {
				logger.info(peer.toString(), 'has joined', JoinedResult[index]);
				assert.ok(JoinedResult[index].includes(channelName));
			}

		}
	});

	it('setup anchor peer', async function () {
		this.timeout(0);
		await sleep(30000);
		if (!process.env.anchor) {
			logger.warn('it skipped due to unspecified process.env.anchor');
			return;
		}
		if (!process.env.binPath) {
			process.env.binPath = path.resolve(__dirname, '../common/bin/');
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







