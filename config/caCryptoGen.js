const caUtil = require('../common/nodejs/ca');

const fs = require('fs');
const {initAdmin, genPeer, init, genOrderer, genUser} = require('../common/nodejs/ca-crypto-gen');
const pathUtil = require('../common/nodejs/path');
const {nodeUtil, dockerode} = require('../common/nodejs/helper');
const dockerCmd = dockerode.cmd;
const {CryptoPath} = pathUtil;
const logger = require('../common/nodejs/logger').new('caCryptoGen');
const globalConfig = require('../config/orgs');
const userUtil = require('../common/nodejs/user');
const helper = require('../app/helper');

const {homeResolve} = nodeUtil.helper();
const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {TLS} = globalConfig;
const protocol = TLS ? 'https' : 'http';
const getCaService = async (port, domain) => {
	const caUrl = `${protocol}://localhost:${port}`;
	if (TLS) {
		const caHostName = `ca.${domain}`;
		const container_name = caHostName;
		const from = caUtil.container.caCert;
		const to = `${caHostName}-cert.pem`;
		await dockerCmd.copy(container_name, from, to);

		const pem = fs.readFileSync(to);
		return caUtil.new(caUrl, [pem]);
	}
	return caUtil.new(caUrl);
};
exports.getCaService = getCaService;
exports.genUser = async ({userName, password}, orgName, swarm) => {
	logger.debug('genUser', {userName, password, orgName, swarm});
	const {config, nodeType} = helper.findOrgConfig(orgName);
	const mspId = config.mspid;
	const caService = await getCaService(config.ca.portHost, orgName, swarm);

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
			name: userUtil.adminName
		},
		password: userUtil.adminPwd
	});

	const admin = await initAdmin(caService, adminCryptoPath, nodeType, mspId, TLS);
	return await genUser(caService, cryptoPath, nodeType, admin, {TLS, affiliationRoot: orgName});

};

exports.genAll = async (swarm) => {

	const {type} = globalConfig.orderer;

	// gen orderers
	{
		const nodeType = 'orderer';

		if (type === 'solo') {
			const ordererConfig = globalConfig.orderer.solo;
			const mspId = ordererConfig.mspid;

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

			const caService = await getCaService(ordererConfig.ca.portHost, domain, swarm);
			const admin = await init(caService, adminCryptoPath, nodeType, mspId);
			const cryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {
					org: domain, name: ordererConfig.container_name
				},
				user: {
					name: userUtil.adminName
				}
			});
			await genOrderer(caService, cryptoPath, admin, {TLS});
		} else {
			const ordererOrgs = globalConfig.orderer[type].orgs;
			for (const domain in ordererOrgs) {
				const ordererConfig = ordererOrgs[domain];
				const mspId = ordererConfig.mspid;

				const caService = await getCaService(ordererConfig.ca.portHost, domain, swarm);
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

		}
	}
	// gen peers
	const peerOrgs = globalConfig.orgs;
	{
		const nodeType = 'peer';
		for (const domain in peerOrgs) {
			const peerOrgConfig = peerOrgs[domain];
			const mspId = peerOrgConfig.mspid;
			const adminCryptoPath = new CryptoPath(caCryptoConfig, {
				peer: {
					org: domain
				},
				user: {
					name: userUtil.adminName
				},
				password: userUtil.adminPwd
			});
			const caService = await getCaService(peerOrgConfig.ca.portHost, domain, swarm);
			const admin = await init(caService, adminCryptoPath, nodeType, mspId);
			const promises = [];
			for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
				const peerName = `peer${peerIndex}`;
				const cryptoPath = new CryptoPath(caCryptoConfig, {
					peer: {
						org: domain, name: peerName
					},
					user: {
						name: userUtil.adminName
					}
				});
				promises.push(genPeer(caService, cryptoPath, admin, {TLS}));
			}
			await Promise.all(promises);
		}
	}
};
