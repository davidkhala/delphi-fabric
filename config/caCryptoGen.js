const CA = require('../common/nodejs/admin/ca');
const CaCryptoGen = require('../common/nodejs/ca-crypto-gen');
const pathUtil = require('../common/nodejs/path');
const fsExtra = require('fs-extra');
const {homeResolve} = require('khala-light-util');
const {CryptoPath} = pathUtil;
const logger = require('khala-logger/log4js').consoleLogger('caCryptoGen');
const globalConfig = require('../config/orgs');
const {adminName, adminPwd} = require('../common/nodejs/formatter/user');
const {loadFromLocal} = require('../common/nodejs/user');

const path = require('path');
const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {TLS} = globalConfig;
const protocol = TLS ? 'https' : 'http';
const hostname = 'localhost';
const getCaService = async (port) => {
	return new CA({protocol, hostname, port});
};
/**
 *
 * @param userName
 * @param password
 * @param orgName
 * @param {NodeType} nodeType
 * @return {Promise<User>}
 */
const genExtraUser = async ({userName, password}, orgName, nodeType) => {
	const config = globalConfig.organizations[orgName];
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
			name: adminName
		},
		password: adminPwd
	});

	const admin = loadFromLocal(adminCryptoPath, nodeType, config.mspid, true);
	const caCryptoGen = new CaCryptoGen(caService, cryptoPath);
	return await caCryptoGen.genUser(nodeType, admin, {TLS, affiliationRoot: orgName});

};
const getClientKeyPairPath = (cryptoPath, nodeType) => {
	const rootDir = path.resolve(cryptoPath[`${nodeType}Org`](), 'client');
	return {
		clientKey: path.resolve(rootDir, 'clientKey'),
		clientCert: path.resolve(rootDir, 'clientCert')
	};
};

const genNSaveClientKeyPair = async (caService, cryptoPath, admin, domain, nodeType) => {
	const caCryptoGen = new CaCryptoGen(caService, cryptoPath);
	const {key, certificate, rootCertificate} = await caCryptoGen.genClientKeyPair({
		enrollmentID: `${domain}.client`,
		enrollmentSecret: 'password'
	}, admin, domain);
	const {clientKey, clientCert} = getClientKeyPairPath(cryptoPath, nodeType);
	fsExtra.outputFileSync(clientCert, certificate);

	fsExtra.outputFileSync(clientKey, key.toBytes());
};

const genAll = async () => {

	// gen orderers
	{
		const nodeType = 'orderer';

		const ordererOrgs = globalConfig.orderer.organizations;
		for (const domain in ordererOrgs) {
			const ordererConfig = ordererOrgs[domain];
			const mspid = ordererConfig.mspid;

			const caService = await getCaService(ordererConfig.ca.portHost, domain);
			const adminCryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {
					org: domain
				},
				user: {
					name: adminName
				},
				password: adminPwd
			});
			const caCryptoGen = new CaCryptoGen(caService, adminCryptoPath);
			const admin = await caCryptoGen.init(nodeType, mspid);
			await genNSaveClientKeyPair(caService, adminCryptoPath, admin, domain, nodeType);
			await caCryptoGen.genOrg(admin, nodeType);
			for (const ordererName in ordererConfig.orderers) {

				const cryptoPath = new CryptoPath(caCryptoConfig, {
					orderer: {
						org: domain, name: ordererName
					},
					user: {
						name: adminName
					}
				});
				// eslint-disable-next-line no-shadow
				const caCryptoGen = new CaCryptoGen(caService, cryptoPath);
				await caCryptoGen.genOrderer(admin, {TLS});
			}

		}

	}
	// gen peers
	const peerOrgs = globalConfig.organizations;
	{
		const nodeType = 'peer';

		for (const domain in peerOrgs) {
			const peerOrgConfig = peerOrgs[domain];
			const mspid = peerOrgConfig.mspid;
			const adminCryptoPath = new CryptoPath(caCryptoConfig, {
				peer: {
					org: domain
				},
				user: {
					name: adminName
				},
				password: adminPwd
			});
			const caService = await getCaService(peerOrgConfig.ca.portHost);
			const caCryptoGen = new CaCryptoGen(caService, adminCryptoPath);
			const admin = await caCryptoGen.init(nodeType, mspid);
			if (TLS) {
				await caCryptoGen.genOrg(admin, nodeType);
			}

			await genNSaveClientKeyPair(caService, adminCryptoPath, admin, domain, nodeType);
			for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
				const peerName = `peer${peerIndex}`;
				const cryptoPath = new CryptoPath(caCryptoConfig, {
					peer: {
						org: domain, name: peerName
					},
					user: {
						name: adminName
					}
				});
				// eslint-disable-next-line no-shadow
				const caCryptoGen = new CaCryptoGen(caService, cryptoPath, logger);
				await caCryptoGen.genPeer(admin, {TLS});

			}

		}
	}
};
module.exports = {
	genAll,
	genExtraUser,
	getCaService,
	getClientKeyPairPath,
};
