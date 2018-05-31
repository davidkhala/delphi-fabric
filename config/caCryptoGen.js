const caUtil = require('../common/nodejs/ca');

const fs = require('fs');
const {genPeer, init, genOrderer} = require('../common/nodejs/ca-crypto-gen');
const pathUtil = require('../common/nodejs/path');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const dockerUtil = require('../common/docker/nodejs/dockerode-util');
const {CryptoPath, homeResolve} = pathUtil;
const logger = require('../common/nodejs/logger').new('ca-crypto-gen');
const globalConfig = require('../config/orgs');
const {TLS} = globalConfig;

const getCaService = async (url, domain, swarm) => {
	if (TLS) {
		const caHostName = `ca.${domain}`;
		let container_name;
		if (swarm) {
			const serviceName = dockerUtil.swarmServiceName(caHostName);
			container_name = await dockerUtil.inflateContainerName(serviceName);
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

exports.genAll = async (swarm) => {

	const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT.dir);
	const {type} = globalConfig.orderer;
	const protocol = TLS ? 'https' : 'http';
	//gen orderers
	{
		const nodeType = 'orderer';

		if (type === 'kafka') {

			const ordererOrgs = globalConfig.orderer.kafka.orgs;
			for (const domain in ordererOrgs) {
				const ordererConfig = ordererOrgs[domain];
				const mspId = ordererConfig.MSP.id;

				const cryptoPath = new CryptoPath(caCryptoConfig, {
					orderer: {
						org: domain
					},
					user: {
						name: 'Admin'
					}
				});
				const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
				const caService = await getCaService(caUrl, domain, swarm);
				const admin = await init(caService, cryptoPath, nodeType, mspId);

				const promises = [];
				for (const ordererName in ordererConfig.orderers) {

					const cryptoPath = new CryptoPath(caCryptoConfig, {
						orderer: {
							org: domain, name: ordererName
						},
						user: {
							name: 'Admin'
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
			const cryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {
					org: domain, name: ordererConfig.container_name
				},
				user: {
					name: 'Admin'
				}
			});

			const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
			const caService = await getCaService(caUrl, domain, swarm);
			const admin = await init(caService, cryptoPath, nodeType, mspId);
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
			const cryptoPath = new CryptoPath(caCryptoConfig, {
				peer: {
					org: domain
				},
				user: {
					name: 'Admin'
				}
			});
			const caUrl = `${protocol}://localhost:${peerOrgConfig.ca.portHost}`;
			const caService = await getCaService(caUrl, domain, swarm);
			const admin = await init(caService, cryptoPath, nodeType, mspId);
			const promises = [];
			for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
				const peerName = `peer${peerIndex}`;
				const cryptoPath = new CryptoPath(caCryptoConfig, {
					peer: {
						org: domain, name: peerName
					},
					user: {
						name: 'Admin'
					}
				});
				promises.push(genPeer(caService, cryptoPath, admin, {TLS}));
			}
			await Promise.all(promises);
		}
	}
};