import path from 'path';
import assert from 'assert';
import fsExtra from 'fs-extra';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {sleep} from '@davidkhala/light/index.js';
import {homeResolve} from '@davidkhala/light/path.js';
import {axiosPromise} from '@davidkhala/axios/index.js';
import {importFrom, filedirname} from '@davidkhala/light/es6.mjs';
import {os} from '@davidkhala/light/devOps.js'
import {setAnchorPeersByOrg} from './channelHelper.js';
import {projectResolve, prepareChannel, newPeers, getOrgAdmin, newOrderers} from './helper.js';
import Orderer from '../common/nodejs/admin/orderer.js';
import {getGenesisBlock} from '../common/nodejs/channel.js';
import QueryHub from '../common/nodejs/query.js';
import {Status} from '../common/nodejs/formatter/constants.js';
import {DeliverResponseType} from '../common/nodejs/formatter/eventHub.js';
import Configtxgen, {configtxgenV2 as ConfigtxgenV2} from '../common/nodejs/binManager/configtxgen.js';
import {DockerRun} from '../common/nodejs/binManager/binManager.js';
import {ContainerManager} from '@davidkhala/docker/docker.js';
import {ConfigtxFileGen, OrderSectionBuilder, OrganizationBuilder} from '../config/configtx.js';

filedirname(import.meta);
const globalConfig = importFrom(import.meta, '../config/orgs.json');
const binPath = process.env.binPath || path.resolve(__dirname, '../common/bin/');
const {join: joinOrderer} = Orderer;
const channelsConfig = globalConfig.channels;

const logger = consoleLogger('channel setup');
const channelName = process.env.channelName || 'allchannel';
describe('channelSetup', function () {
	this.timeout(0);

	function configtxYamlGen(MSPROOTPath, configtxFile) {
		//	refresh configtxFile
		if (fsExtra.pathExistsSync(configtxFile)) {
			fsExtra.removeSync(configtxFile);
		}
		const fileGen = new ConfigtxFileGen(logger);
		for (const channelName in channelsConfig) {
			const channelConfig = channelsConfig[channelName];
			const sectionBuilder = new OrderSectionBuilder(MSPROOTPath, 'etcdraft', logger);
			for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
				for (const ordererName in ordererOrgConfig.orderers) {
					sectionBuilder.addOrderer(ordererName, ordererOrgName);
				}
				sectionBuilder.addOrg(ordererOrgName, ordererOrgConfig);
			}
			const Organizations = Object.keys(channelConfig.organizations).map(orgName => OrganizationBuilder(orgName, globalConfig.organizations[orgName], MSPROOTPath, 'peer'));
			fileGen.addProfile(channelName, sectionBuilder, Organizations);
		}
		fileGen.build(configtxFile);
	}


	if (os.platform === 'win32') {
		// TODO WIP
		it('generate configtx.yaml (win)', async () => {

			configtxYamlGen('/tmp', projectResolve('config', 'configtx.yaml'));


		});
		it('generate block(win)', async () => {
			const channelConfig = channelsConfig[channelName];
			const channelBlock = homeResolve(channelConfig.file);
			const configtxFile = projectResolve('config', 'configtx.yaml');
			const container = new ContainerManager();
			const cli = new DockerRun(container);
			await cli.stop();
			const containerMSPROOT = '/tmp/crypto-config/';
			await cli.start({
				MSPROOT: containerMSPROOT
			});

			const configtxgen = new ConfigtxgenV2(channelName, configtxFile, channelName, container);
			await configtxgen.genBlock(channelBlock);


		});
	}else {
		it('generate configtx.yaml', async () => {
			configtxYamlGen(homeResolve(globalConfig.docker.volumes.MSPROOT), projectResolve('config', 'configtx.yaml'));
		});
		it('generate Block', async () => {
			const channelConfig = channelsConfig[channelName];
			const channelBlock = homeResolve(channelConfig.file);
			const configtxFile = projectResolve('config', 'configtx.yaml');

			const configtxgen = new Configtxgen(channelName, configtxFile, channelName, binPath);
			await configtxgen.genBlock(channelBlock);
		});
	}


	it('join Orderer', async () => {
		// params
		const channelConfig = globalConfig.channels[channelName];
		const blockFile = homeResolve(channelConfig.file);

		// end params

		for (const ordererOrgName of Object.keys(globalConfig.orderer.organizations)) {
			const orderers = newOrderers(ordererOrgName);

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
		const channel = prepareChannel(channelName);
		for (const ordererOrgName of Object.keys(globalConfig.orderer.organizations)) {
			const orderers = newOrderers(ordererOrgName);

			for (const orderer of orderers) {
				const user = getOrgAdmin(ordererOrgName, 'orderer');
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
		const channel = prepareChannel(channelName);
		// end params
		//
		for (const [orgName, {peerIndexes}] of Object.entries(channelConfig.organizations)) {
			const peers = newPeers(peerIndexes, orgName);
			const user = getOrgAdmin(orgName);
			const queryHub = new QueryHub(peers, user);
			await queryHub.connect();
			if (binPath) {
				await queryHub.joinWithFile(blockFile, channelName);
			} else {
				const orderers = newOrderers();
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
			const peers = newPeers(peerIndexes, orgName);

			const user = getOrgAdmin(orgName);

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

		const orderers = newOrderers();
		const orderer = orderers[0];
		await orderer.connect();
		for (const org in channelConfig.organizations) {
			await setAnchorPeersByOrg(channelName, org, orderer, binPath);
		}
		await orderer.disconnect();
	});
});






