const globalConfig = require('../config/orgs');
const {TLS, docker: {volumes: {MSPROOT: {dir: mspDir}}}} = globalConfig;
const protocol = TLS ? 'https' : 'http';

const {CryptoPath, homeResolve} = require('../common/nodejs/path');
const {genOrderer} = require('../common/nodejs/ca-crypto-gen');
const caUtil = require('../common/nodejs/ca');
const {swarmServiceName, inflateContainerName} = require('../common/docker/nodejs/dockerode-util');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const {ConfigFactory,channelUpdate,getChannelConfigReadable}= require('../common/nodejs/configtxlator');
const caCryptoConfig = homeResolve(mspDir);
const fs = require('fs');
const helper = require('./helper');
const nodeType = 'orderer';
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

const startContainer = async () => {

};
const stopContainer = async () => {

};
const run = async () => {
	if(process.env.action ==='down'){
		await stopContainer();
		return;
	}

	const ordererName = 'orderer3';
	const orgName = 'DelphiConsensus.Delphi.com';
	const swarm = false;
	const hostCryptoPath = new CryptoPath(caCryptoConfig, {
		orderer: {
			org: orgName, name: ordererName
		},
		password: 'passwd',
		user: {
			name: 'Admin'
		}
	});
	/////////update address
	const ordererAdress = `${hostCryptoPath.ordererHostName}:7050`;


	const {port} = require('../swarm/swarm.json').swarmServer;

	Request.post({url:})
	const ordererConfig = globalConfig.orderer.kafka.orgs[orgName];

	const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
	const caService = await getCaService(caUrl, orgName, swarm);
	const adminClient = await helper.getOrgAdmin(orgName, nodeType);
	const admin = adminClient._userContext;
	await genOrderer(caService, hostCryptoPath, admin, {TLS});


	const randomOrdererOrg = helper.randomOrg('orderer');
	const ordererClient = await helper.getOrgAdmin(randomOrdererOrg, 'orderer');
	const ordererChannel = helper.prepareChannel(undefined, ordererClient, true);

	const onUpdate = (original_config) => {
		const config = new ConfigFactory(original_config);
		config.addOrdererAddress(ordererAdress);
		return config.build();
	};


	const peerEventHub = undefined;

	await channelUpdate(ordererChannel, onUpdate, signatureCollector, peerEventHub, {nodeType: 'orderer'});

	await startContainer();
};
run();
