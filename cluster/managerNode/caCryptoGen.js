const config = require('./config');

const ordererOrg = 'NewConsensus';
const ordererName = 'orderer0';
const fs = require('fs');
const logger = require('../../common/nodejs/logger').new('caCryptogen');
const caCryptoGen = require('../../common/nodejs/ca-crypto-gen');
const {CryptoPath, homeResolve} = require('../../common/nodejs/path');
const cryptoRoot = homeResolve(config.MSPROOT);
const dockerUtil = require('../../common/docker/nodejs/dockerode-util');
const dockerCmd = require('../../common/docker/nodejs/dockerCmd');
const caUtil = require('../../common/nodejs/ca');
const peerOrg = 'NEW';
const peerName = 'newContainer';
const {globalConfig} = require('./swarmClient');
const fsExtra = require('fs-extra');
const {PM2} = require('../../common/nodejs/express/pm2Manager');
const signServer = require('./signServer');
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
const asyncTask = async (action) => {
	logger.debug('[start] caCryptogen');
	const pm2 = new PM2();
	const signServerProcessName = 'signServer';

	if (action === 'down') {
		fsExtra.removeSync(cryptoRoot);
		await pm2.connect();
		await pm2.delete({name: signServerProcessName});
		pm2.disconnect();
		signServer.clean();
		logger.info('[done] down');
		return;
	}
	const {TLS} = await globalConfig();

	const cryptoPath = new CryptoPath(cryptoRoot, {
		orderer: {
			org: ordererOrg, name: ordererName
		},
		peer: {
			org: peerOrg, name: peerName
		},
		user: {name: 'Admin'},
		password: 'passwd'
	});
	if (fs.existsSync(cryptoPath.orderers())) {
		logger.info('orderers exist, skipping create');
	} else {
		const ordererConfig = config.orderer.orgs[ordererOrg];
		const ordererCAurl = `http${TLS ? 's' : ''}://localhost:${ordererConfig.ca.portHost}`;
		const ordererCaService = await getCaService(ordererCAurl, ordererOrg, TLS);
		const ordererAdmin = await caCryptoGen.init(ordererCaService, cryptoPath, 'orderer', ordererConfig.MSP.id);
		await caCryptoGen.genOrderer(ordererCaService, cryptoPath, ordererAdmin, {TLS});
	}

	if (fs.existsSync(cryptoPath.peers())) {
		logger.info('peers exist, skipping create');
	} else {
		const peerConfig = config.orgs[peerOrg];
		const peerCAURL = `http${TLS ? 's' : ''}://localhost:${peerConfig.ca.portHost}`;
		const peerCaService = await getCaService(peerCAURL, peerOrg, TLS);
		const peerAdmin = await caCryptoGen.init(peerCaService, cryptoPath, 'peer', peerConfig.MSP.id);
		await caCryptoGen.genPeer(peerCaService, cryptoPath, peerAdmin, {TLS});
	}


	const script = homeResolve(config.signServer.path);
	await pm2.connect();
	await pm2.run({name: signServerProcessName, script});
	pm2.disconnect();
};

try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}



