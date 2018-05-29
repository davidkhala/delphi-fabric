const caUtil = require('../common/nodejs/ca');

const fs = require('fs');
const userUtil = require('../common/nodejs/user');
const pathUtil = require('../common/nodejs/path');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const dockerUtil = require('../common/docker/nodejs/dockerode-util');
const {CryptoPath} = pathUtil;
const logger = require('../common/nodejs/logger').new('ca-crypto-gen');
const affiliationUtil = require('../common/nodejs/affiliationService');
const globalConfig = require('../config/orgs');
const {TLS} = globalConfig;

exports.initAdmin = async (caService, {mspId, domain}, cryptoPath, nodeType) => {
	const enrollmentID = cryptoPath.userName;
	const enrollmentSecret = 'passwd';

	const type = `${nodeType}User`;
	const userFull = cryptoPath[`${nodeType}UserHostName`];
	const user = await userUtil.loadFromLocal(cryptoPath, nodeType, {mspId}, undefined);
	if (user) {
		logger.info(`${domain} admin found in local`);
		return user;
	}

	const result = await caService.enroll({enrollmentID, enrollmentSecret});
	caUtil.toMSP(result, cryptoPath, type);
	caUtil.org.saveAdmin(result, cryptoPath, nodeType);

	return await userUtil.build(userFull, result, mspId);
};
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
exports.init = async (caService, {mspId, domain, affiliationRoot = domain}, cryptoPath, nodeType) => {
	logger.debug('init', {affiliationRoot, mspId, domain}, cryptoPath, nodeType);
	const affiliationService = caService.newAffiliationService();
	const force = true;//true to create recursively


	const adminUser = await exports.initAdmin(caService, {mspId, domain}, cryptoPath, nodeType);
	const promises = [affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.user`, force}, adminUser),
		affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.peer`, force}, adminUser),
		affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.orderer`, force}, adminUser)];
	await Promise.all(promises);
	return adminUser;

};
/**
 * @param caService
 * @param cryptoPath
 * @param admin
 * @param affiliationRoot
 * @returns {Promise<*>}
 */
exports.genOrderer = async (caService, cryptoPath, admin, affiliationRoot) => {

	const type = 'orderer';
	const {ordererHostName, ordererOrgName: domain} = cryptoPath;
	if (!affiliationRoot) affiliationRoot = domain;
	const ordererMSPRoot = cryptoPath.MSP(type);

	const exist = cryptoPath.cryptoExistLocal(type);
	if (exist) {
		logger.info(`crypto exist in ${ordererMSPRoot}`);
		return;
	}

	const enrollmentID = ordererHostName;
	const enrollmentSecret = 'passwd';
	const certificate = userUtil.getCertificate(admin);
	caUtil.peer.toAdminCerts({certificate}, cryptoPath, type);
	await caUtil.register(caService, {
		enrollmentID,
		enrollmentSecret,
		role: 'orderer',
		affiliation: `${affiliationRoot}.orderer`
	}, admin);

	const result = await caService.enroll({enrollmentID, enrollmentSecret});
	caUtil.toMSP(result, cryptoPath, type);
	if (TLS) {
		const tlsResult = await caService.enroll({enrollmentID, enrollmentSecret, profile: 'tls'});
		caUtil.toTLS(tlsResult, cryptoPath, type);
		caUtil.org.saveTLS(tlsResult, cryptoPath, type);
	}
	return admin;

};
/**
 *
 * @param caService
 * @param {path.CryptoPath} cryptoPath
 * @param affiliationRoot
 * @param admin
 * @returns {*}
 */
exports.genPeer = async (caService, cryptoPath, admin, affiliationRoot) => {
	const type = 'peer';

	const {peerHostName, peerOrgName: domain} = cryptoPath;
	if (!affiliationRoot) affiliationRoot = domain;
	const peerMSPRoot = cryptoPath.MSP(type);

	const exist = cryptoPath.cryptoExistLocal(type);
	if (exist) {
		logger.info(`crypto exist in ${peerMSPRoot}`);
		return;
	}

	const enrollmentID = peerHostName;
	const enrollmentSecret = 'passwd';
	const certificate = userUtil.getCertificate(admin);
	caUtil.peer.toAdminCerts({certificate}, cryptoPath, type);
	await caUtil.register(caService, {
		enrollmentID,
		enrollmentSecret,
		role: 'peer',
		affiliation: `${affiliationRoot}.peer`
	}, admin);
	const result = await caService.enroll({enrollmentID, enrollmentSecret});
	caUtil.toMSP(result, cryptoPath, type);
	if (TLS) {
		const tlsResult = await caService.enroll({enrollmentID, enrollmentSecret, profile: 'tls'});
		caUtil.toTLS(tlsResult, cryptoPath, type);
		caUtil.org.saveTLS(tlsResult, cryptoPath, type);
	}
};


exports.genAll = async (swarm) => {

	const caCryptoConfig = globalConfig.docker.volumes.MSPROOT.dir;
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
				const admin = await exports.init(caService, {mspId, domain}, cryptoPath, nodeType);

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
					promises.push(exports.genOrderer(caService, cryptoPath, admin));
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
			const admin = await exports.init(caService, {mspId, domain}, cryptoPath, nodeType);
			await exports.genOrderer(caService, cryptoPath, admin);
		}
	}
	//gen peers
	const peerOrgs = globalConfig.orgs;
	{
		const cryptoType = 'peer';
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
			const admin = await exports.init(caService, {mspId, domain}, cryptoPath, cryptoType);
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
				promises.push(exports.genPeer(caService, cryptoPath, admin));
			}
			await Promise.all(promises);
		}
	}
};