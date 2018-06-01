const config = require('./config');

const ordererOrg = 'NewConsensus';


const ordererName = 'orderer0';
const fs = require('fs');
const caCryptoGen = require('../../../common/nodejs/ca-crypto-gen');
const {CryptoPath,homeResolve} = require('../../../common/nodejs/path');
const cryptoRoot = homeResolve(config.MSPROOT);
const dockerUtil = require('../../../common/docker/nodejs/dockerode-util');
const dockerCmd = require('../../../common/docker/nodejs/dockerCmd');
const caUtil = require('../../../common/nodejs/ca');
const peerOrg = 'NEW';
const peerName = 'newContainer';
const {globalConfig} = require('./swarmClient');
const getCaService = async (url, domain, TLS) => {
	if (TLS) {
		const caHostName = `ca.${domain}`;
		const serviceName = dockerUtil.swarmServiceName(caHostName);
		const container_name = await dockerUtil.inflateContainerName(serviceName);
		if (!container_name) throw `service ${serviceName} not assigned to current node`;
		const from = caUtil.container.caCert;
		const to = `${caHostName}-cert.pem`;
		await dockerCmd.copy(container_name, from, to);

		const pem = fs.readFileSync(to);
		return caUtil.new(url, [pem]);
	}
	return caUtil.new(url);
};
const asyncTask = async () => {
	const {TLS} = await globalConfig;
	const ordererConfig = config.orderer.orgs[ordererOrg];
	const ordererCAurl = `http${TLS ? 's' : ''}://localhost:${ordererConfig.ca.portHost}`;
	const ordererCaService = await getCaService(ordererCAurl, ordererOrg, TLS);
	let cryptoPath = new CryptoPath(cryptoRoot, {
		orderer: {
			org: ordererOrg,name:ordererName
		},
		user:{name:'Admin'}
	});
	const ordererAdmin = await caCryptoGen.init(ordererCaService, cryptoPath, 'orderer', ordererConfig.MSP.id);
	await caCryptoGen.genOrderer(ordererCaService, cryptoPath, ordererAdmin, {TLS});

	const peerConfig = config.orgs[peerOrg];
	const peerCAURL = `http${TLS ? 's' : ''}://localhost:${peerConfig.ca.portHost}`;
	cryptoPath = new CryptoPath(cryptoRoot, {
		peer: {
			org: peerOrg, name: peerName
		},
		user:{name:'Admin'}
	});
	const peerCaService = await getCaService(peerCAURL, peerOrg, TLS);
	const peerAdmin = await caCryptoGen.init(peerCaService, cryptoPath, 'peer', peerConfig.MSP.id);
	await caCryptoGen.genPeer(peerCaService, cryptoPath, peerAdmin, {TLS});
};


asyncTask();


