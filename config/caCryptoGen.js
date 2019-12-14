const caUtil = require('../common/nodejs/ca');

const fs = require('fs');
const dockerCmd = require('khala-dockerode/dockerCmd');
const {initAdmin, genPeer, init, genOrderer, genUser, genClientKeyPair} = require('../common/nodejs/ca-crypto-gen');
const {pkcs11_key, intermediateCA} = require('../common/nodejs/ca');
const pathUtil = require('../common/nodejs/path');
const {homeResolve, fsExtra} = require('khala-nodeutils/helper');
const {CryptoPath} = pathUtil;
const logger = require('../common/nodejs/logger').new('caCryptoGen');
const globalConfig = require('../config/orgs');
const userUtil = require('../common/nodejs/user');
const helper = require('../app/helper');

const path = require('path');
const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {TLS} = globalConfig;
const protocol = TLS ? 'https' : 'http';
const hackCACert = async (domain) => {
	const caHostName = `ca.${domain}`;
	const container_name = caHostName;
	const from = caUtil.container.caCert; // signcert === caRoot
	const to = `${caHostName}-cert.pem`;
	await dockerCmd.copy(container_name, from, to);
	return fs.readFileSync(to).toString();
};
const getCaService = async (port, domain, useHack) => {
	const caUrl = `${protocol}://localhost:${port}`;
	const trustedRoots = [];
	if (TLS && useHack) {
		const pem = await hackCACert(domain);
		trustedRoots.push(pem);
	}
	return caUtil.new(caUrl, trustedRoots);
};
exports.getCaService = getCaService;
exports.genUser = async ({userName, password}, orgName) => {
	logger.debug('genUser', {userName, password, orgName});
	const {config, nodeType} = helper.findOrgConfig(orgName);
	const mspId = config.mspid;
	const caService = await getCaService(config.ca.portHost, orgName);

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
const genNSaveClientKeyPair = async (caService, cryptoPath, admin, domain, nodeType) => {
	const {key, certificate, rootCertificate} = await genClientKeyPair(caService, {
		enrollmentID: `${domain}.client`,
		enrollmentSecret: 'password'
	}, admin, domain);
	const rootDir = path.resolve(cryptoPath[`${nodeType}Org`](), 'client');
	const keyFile = path.resolve(rootDir, 'clientKey');
	const certFile = path.resolve(rootDir, 'clientCert');
	fsExtra.outputFileSync(certFile, certificate);
	pkcs11_key.save(keyFile, key);
};
/**
 *
 * @param parentCADomain
 * @param parentCAPort
 * @param nodeType
 * @return {Promise<void>}
 */
exports.genIntermediate = async (parentCADomain, parentCAPort, nodeType) => {
	const caService = await getCaService(parentCAPort, parentCADomain);
	const mspId = nodeType === 'orderer' ? globalConfig.orderer.etcdraft.orgs[parentCADomain].mspid : globalConfig.orgs[parentCADomain].mspid;
	const adminCryptoPath = new CryptoPath(caCryptoConfig, {
		[nodeType]: {
			org: parentCADomain
		},
		user: {
			name: userUtil.adminName
		},
		password: userUtil.adminPwd
	});
	const admin = await initAdmin(caService, adminCryptoPath, nodeType, mspId, TLS);
	const enrollmentID = `${userUtil.adminName}.intermediate`;
	let enrollmentSecret = userUtil.adminPwd;
	const result = await intermediateCA.register(caService, admin, {
		enrollmentID, enrollmentSecret,
		affiliation: parentCADomain
	});
	logger.debug(result);
	return {enrollmentSecret, enrollmentID};
};
exports.genAll = async () => {

	const {type} = globalConfig.orderer;

	// gen orderers
	{
		const nodeType = 'orderer';

		const ordererOrgs = globalConfig.orderer[type].orgs;
		for (const domain in ordererOrgs) {
			const ordererConfig = ordererOrgs[domain];
			const mspId = ordererConfig.mspid;

			const caService = await getCaService(ordererConfig.ca.portHost, domain);
			const adminCryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {
					org: domain
				},
				user: {
					name: userUtil.adminName
				},
				password: userUtil.adminPwd
			});
			const admin = await init(caService, adminCryptoPath, nodeType, mspId, TLS);
			await genNSaveClientKeyPair(caService, adminCryptoPath, admin, domain, nodeType);
			const promises = [];
			for (const ordererName in ordererConfig.orderers) {

				const cryptoPath = new CryptoPath(caCryptoConfig, {
					orderer: {
						org: domain, name: ordererName
					},
					user: {
						name: userUtil.adminName
					}
				});
				promises.push(genOrderer(caService, cryptoPath, admin, {TLS}));
			}
			await Promise.all(promises);
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
			const caService = await getCaService(peerOrgConfig.ca.portHost, domain);
			const admin = await init(caService, adminCryptoPath, nodeType, mspId, TLS);
			const promises = [];
			await genNSaveClientKeyPair(caService, adminCryptoPath, admin, domain, nodeType);
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
