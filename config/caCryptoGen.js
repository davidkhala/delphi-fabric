import path from 'path';
import fsExtra from 'fs-extra';
import {homeResolve} from '@davidkhala/light/index.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {adminName, adminPwd} from '../common/nodejs/formatter/user.js';
import {loadFromLocal} from '../common/nodejs/user.js';
import {importFrom} from '@davidkhala/light/es6.mjs';
import CA from '../common/nodejs/admin/ca.js';
import CaCryptoGen from '../common/nodejs/ca-crypto-gen.js';
import * as pathUtil from '../common/nodejs/path.js';

const logger = consoleLogger('caCryptoGen');

const globalConfig = importFrom('../config/orgs.json', import.meta);



const {CryptoPath} = pathUtil;

const caCryptoConfig = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {TLS} = globalConfig;
const protocol = TLS ? 'https' : 'http';
const hostname = 'localhost';
export const getCaService = async (port) => {
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
export const genExtraUser = async ({userName, password}, orgName, nodeType) => {
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
	return await caCryptoGen.genUser(nodeType, admin);

};
export const getClientKeyPairPath = (cryptoPath, nodeType) => {
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

export const genAll = async () => {

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
