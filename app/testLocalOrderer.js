const globalConfig = require('../config/orgs');
const {TLS, docker: {fabricTag, network, volumes: {MSPROOT: {dir: mspDir}}}, orderer: {genesis_block: {file: BLOCK_FILE}}} = globalConfig;
const protocol = TLS ? 'https' : 'http';
const logger = require('../common/nodejs/logger').new('local orderer');
const {CryptoPath, fsExtra} = require('../common/nodejs/path');
const {genOrderer, init} = require('../common/nodejs/ca-crypto-gen');
const caUtil = require('../common/nodejs/ca');
const {swarmServiceName, inflateContainerName, containerDelete, containerStart} = require('../common/docker/nodejs/dockerode-util');
const {runOrderer, runCA} = require('../common/nodejs/fabric-dockerode');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const {RequestPromise} = require('../common/nodejs/express/serverClient');
const peerUtil = require('../common/nodejs/peer');
const helper = require('./helper');
const {projectResolve} = helper;
const caCryptoConfig = projectResolve(mspDir);
const {port: swarmServerPort} = require('../swarm/swarm.json').swarmServer;
const fs = require('fs');

const nodeType = 'orderer';
const arch = 'x86_64';
const imageTag = `${arch}-${fabricTag}`;
const {sleep} = require('khala-nodeutils/helper');
const getCaService = async (url, domain, swarm) => {
	if (TLS) {
		const caHostName = `ca.${domain}`;
		let container_name;
		if (swarm) {
			const serviceName = swarmServiceName(caHostName);
			container_name = await inflateContainerName(serviceName);
			if (!container_name) throw `service ${serviceName} not assigned to current node`;
		} else {
			container_name = caHostName;
		}
		const from = caUtil.container.caCert;
		const to = `${caHostName}-cert.pem`;
		await dockerCmd.copy(container_name, from, to);

		const pem = fs.readFileSync(to);
		return caUtil.new(url, [pem]);
	}
	return caUtil.new(url);
};

const ordererName = 'orderer3';
const channelName = 'allchannel';
const serverClient = require('../common/nodejs/express/serverClient');
const runWithNewOrg = async (action) => {
	const orgName = 'NewConsensus.Delphi.com';
	const mspName = 'NewConsensus';
	const mspid = 'NewConsensusMSP';
	const caContainerName = `ca.${orgName}`;
	const port = 9054;
	const hostCryptoPath = new CryptoPath(caCryptoConfig, {
		orderer: {
			org: orgName, name: ordererName
		},
		password: 'passwd',
		user: {
			name: 'Admin'
		}
	});
	if (action === 'down') {
		await containerDelete(caContainerName);
		await run(orgName, undefined, undefined, action, mspid);
		fsExtra.emptyDirSync(hostCryptoPath.ordererOrg());
		return;
	}
	await runCA({container_name: caContainerName, port, network, imageTag, TLS});

	const caUrl = `${protocol}://localhost:${port}`;
	const caService = await getCaService(caUrl, orgName, false);

	await sleep(2000);

	const admin = await init(caService, hostCryptoPath, nodeType, mspid, {TLS});

	const {msp: {admincerts, cacerts, tlscacerts}} = hostCryptoPath.OrgFile(nodeType);


	const baseUrl = `http://localhost:${swarmServerPort}`;
	await serverClient.createOrUpdateOrg(baseUrl, channelName, mspid, mspName, nodeType, {
		admins: [admincerts],
		root_certs: [cacerts],
		tls_root_certs: [tlscacerts]
	}, false);

	const container_name = hostCryptoPath.ordererHostName;
	if (action === 'down') {
		await containerDelete(container_name);
		return;
	}


	/////////update address
	const ordererAdress = `${hostCryptoPath.ordererHostName}:7050`;


	const url = `http://localhost:${swarmServerPort}/channel/newOrderer`;


	try {
		await RequestPromise({url, body: {address: ordererAdress}});

		await genOrderer(caService, hostCryptoPath, admin, {TLS});


		const {MSPROOT} = peerUtil.container;

		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {
				org: orgName, name: ordererName
			},
			password: 'passwd',
			user: {
				name: 'Admin'
			}
		});
		const ordererUtil = require('../common/nodejs/orderer');
		const tls = TLS ? cryptoPath.TLSFile(nodeType) : undefined;
		const configPath = cryptoPath.MSP(nodeType);
		const Image = `hyperledger/fabric-orderer:${imageTag}`;
		const Cmd = ['orderer'];
		const Env = ordererUtil.envBuilder({
			BLOCK_FILE, msp: {
				configPath, id: mspid
			}, kafkas: true, tls
		});

		const createOptions = {
			name: container_name,
			Env,
			Volumes: {
				[peerUtil.container.MSPROOT]: {},
				[ordererUtil.container.CONFIGTX]: {},
				[ordererUtil.container.state]: {}
			},
			Cmd,
			Image,
			ExposedPorts: {
				'7050': {},
			},
			Hostconfig: {
				Binds: [
					`MSPROOT:${peerUtil.container.MSPROOT}`,
					`CONFIGTX:${ordererUtil.container.CONFIGTX}`,
					`ledger:${ordererUtil.container.state}`
				],
				PortBindings: {
					'7050': [
						{
							HostPort: '9050'
						}
					]
				},
			},
			NetworkingConfig: {
				EndpointsConfig: {
					[network]: {
						Aliases: [container_name]
					}
				}
			}
		};
		return containerStart(createOptions);

	} catch (e) {
		logger.error(e);
		process.exit(1);
	}

};
const runWithExistOrg = async (action) => {
	const orgName = 'DelphiConsensus.Delphi.com';
	const ordererConfig = globalConfig.orderer.kafka.orgs[orgName];
	const mspid = ordererConfig.MSP.id;
	const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
	const caService = await getCaService(caUrl, orgName, false);
	const adminClient = await helper.getOrgAdmin(orgName, nodeType);
	const admin = adminClient._userContext;
	await run(orgName, caService, admin, action, mspid);
};
/**
 *
 * @param orgName
 * @param caService
 * @param admin
 * @param action
 * @param mspid
 * @returns {Promise<void>}
 */
const run = async (orgName, caService, admin, action, mspid) => {
	const hostCryptoPath = new CryptoPath(caCryptoConfig, {
		orderer: {
			org: orgName, name: ordererName
		},
		password: 'passwd',
		user: {
			name: 'Admin'
		}
	});
	const container_name = hostCryptoPath.ordererHostName;
	if (action === 'down') {
		await containerDelete(container_name);
		return;
	}


	/////////update address
	const ordererAdress = `${hostCryptoPath.ordererHostName}:7050`;


	const url = `http://localhost:${swarmServerPort}/channel/newOrderer`;


	try {
		await RequestPromise({url, body: {address: ordererAdress}});

		await genOrderer(caService, hostCryptoPath, admin, {TLS});


		const {MSPROOT} = peerUtil.container;

		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {
				org: orgName, name: ordererName
			},
			password: 'passwd',
			user: {
				name: 'Admin'
			}
		});
		const tls = TLS ? cryptoPath.TLSFile(nodeType) : undefined;
		const configPath = cryptoPath.MSP(nodeType);
		await runOrderer({
			container_name, imageTag,
			port: 9050, network,
			BLOCK_FILE, CONFIGTXVolume: 'CONFIGTX',
			msp: {
				id: mspid,
				configPath,
				volumeName: 'MSPROOT'
			},
			kafkas: true,
			tls
		});

	} catch (e) {
		logger.error(e);
		process.exit(1);
	}

};
runWithNewOrg(process.env.action);