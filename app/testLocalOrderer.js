const globalConfig = require('../config/orgs');
const {TLS, docker: {fabricTag, network, volumes: {MSPROOT: {dir: mspDir}}}, orderer: {genesis_block: {file: BLOCK_FILE}}} = globalConfig;
const protocol = TLS ? 'https' : 'http';

const logger = require('../common/nodejs/logger').new('local orderer');
const {CryptoPath, homeResolve} = require('../common/nodejs/path');
const {genOrderer} = require('../common/nodejs/ca-crypto-gen');
const caUtil = require('../common/nodejs/ca');
const {swarmServiceName, inflateContainerName,containerDelete} = require('../common/docker/nodejs/dockerode-util');
const {runOrderer} = require('../common/nodejs/fabric-dockerode');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const {RequestPromise} = require('../common/nodejs/express/serverClient');
const peerUtil = require('../common/nodejs/peer');
const caCryptoConfig = homeResolve(mspDir);
const fs = require('fs');
const helper = require('./helper');
const nodeType = 'orderer';
const arch = 'x86_64';
const imageTag = `${arch}-${fabricTag}`;
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


const run = async () => {
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
	if (process.env.action === 'down') {
		await containerDelete(container_name);
		return;
	}

	const ordererName = 'orderer3';
	const orgName = 'DelphiConsensus.Delphi.com';
	const swarm = false;

	/////////update address
	const ordererAdress = `${hostCryptoPath.ordererHostName}:7050`;


	const {port: swarmServerPort} = require('../swarm/swarm.json').swarmServer;
	const url = `http://localhost:${swarmServerPort}/channel/newOrderer`;

	const ordererConfig = globalConfig.orderer.kafka.orgs[orgName];
	const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;

	try {
		const caService = await getCaService(caUrl, orgName, swarm);
		const adminClient = await helper.getOrgAdmin(orgName, nodeType);
		const admin = adminClient._userContext;
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
				id: ordererConfig.MSP.id,
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
run();
