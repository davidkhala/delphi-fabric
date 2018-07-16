const caUtil = require('../common/nodejs/ca');

const fs = require('fs');
const {initAdmin, genPeer, init, genOrderer, genUser} = require('../common/nodejs/ca-crypto-gen');
const pathUtil = require('../common/nodejs/path');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const {swarmServiceName, inflateContainerName} = require('../common/docker/nodejs/dockerode-util');
const {CryptoPath, homeResolve} = pathUtil;
const logger = require('../common/nodejs/logger').new('caCryptoGen');
const globalConfig = require('../config/orgs');
const userUtil = require('../common/nodejs/user');
const helper = require('../app/helper');
const {TLS} = globalConfig;
const protocol = TLS ? 'https' : 'http';
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
exports.genUser = async ({userName, password}, orgName, swarm) => {
	logger.debug('genUser', {userName, password, orgName, swarm});
	const {config, nodeType} = helper.findOrgConfig(orgName);
	const mspId = config.MSP.id;
	const caUrl = `${protocol}://localhost:${config.ca.portHost}`;
	const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT.dir);
	const caService = await getCaService(caUrl, orgName, swarm);

	const cryptoPath = new CryptoPath(caCryptoConfig, {
		[nodeType]: {
			org: orgName
		},
		user: {
			name: userName
		},
		password
	});
	const adminCryptoPath = new CryptoPath(caCryptoConfig, {
		[nodeType]: {
			org: orgName
		},
		user: {
			name: userUtil.adminName,
		},
		password: userUtil.adminPwd
	});

	const admin = await initAdmin(caService, adminCryptoPath, nodeType, mspId, TLS);
	return await genUser(caService, cryptoPath, nodeType, admin, {TLS, affiliationRoot: orgName});

};

exports.genAll = async (swarm) => {

	const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT.dir);
	const {type} = globalConfig.orderer;

	//gen orderers
	{
		const nodeType = 'orderer';

		if (type === 'kafka') {

			const ordererOrgs = globalConfig.orderer.kafka.orgs;
			for (const domain in ordererOrgs) {
				const ordererConfig = ordererOrgs[domain];
				const mspId = ordererConfig.MSP.id;

				const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
				const caService = await getCaService(caUrl, domain, swarm);
				const adminCryptoPath = new CryptoPath(caCryptoConfig, {
					orderer: {
						org: domain
					},
					user: {
						name: userUtil.adminName
					},
					password: userUtil.adminPwd
				});
				const admin = await init(caService, adminCryptoPath, nodeType, mspId);

				const promises = [];
				for (const ordererName in ordererConfig.orderers) {

					const cryptoPath = new CryptoPath(caCryptoConfig, {
						orderer: {
							org: domain, name: ordererName
						}
					});
					promises.push(genOrderer(caService, cryptoPath, admin, {TLS}));
				}
				await Promise.all(promises);


			}

		} else {
			const ordererConfig = globalConfig.orderer.solo;
			const mspId = ordererConfig.MSP.id;

			const domain = ordererConfig.orgName;
			const adminCryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {
					org: domain
				},
				password: userUtil.adminPwd,
				user: {
					name: userUtil.adminName
				}
			});

			const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
			const caService = await getCaService(caUrl, domain, swarm);
			const admin = await init(caService, adminCryptoPath, nodeType, mspId);
			const cryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {
					org: domain, name: ordererConfig.container_name
				},
			});
			await genOrderer(caService, cryptoPath, admin, {TLS});
		}
	}
	//gen peers
	const peerOrgs = globalConfig.orgs;
	{
		const nodeType = 'peer';
		for (const domain in peerOrgs) {
			const peerOrgConfig = peerOrgs[domain];
			const mspId = peerOrgConfig.MSP.id;
			const adminCryptoPath = new CryptoPath(caCryptoConfig, {
				peer: {
					org: domain
				},
				user: {
					name: userUtil.adminName
				},
				password: userUtil.adminPwd
			});
			const caUrl = `${protocol}://localhost:${peerOrgConfig.ca.portHost}`;
			const caService = await getCaService(caUrl, domain, swarm);
			const admin = await init(caService, adminCryptoPath, nodeType, mspId);
			const promises = [];
			for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
				const peerName = `peer${peerIndex}`;
				const cryptoPath = new CryptoPath(caCryptoConfig, {
					peer: {
						org: domain, name: peerName
					}
				});
				promises.push(genPeer(caService, cryptoPath, admin, {TLS}));
			}
			await Promise.all(promises);
		}
	}
};