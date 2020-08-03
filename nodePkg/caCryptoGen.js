const CA = require('khala-fabric-sdk-node-builder/ca');
const {genPeer, init, genOrderer, genUser, genClientKeyPair} = require('khala-fabric-sdk-node/ca-crypto-gen');
const {intermediateCA} = require('khala-fabric-sdk-node/ca');
const pathUtil = require('khala-fabric-sdk-node/path');
const {fsExtra} = require('khala-nodeutils/helper');
const {CryptoPath} = pathUtil;
const {adminName, adminPwd} = require('khala-fabric-formatter/user');
const UserUtil = require('khala-fabric-sdk-node/user');
const {ECDSA_Key} = require('khala-fabric-formatter/key');
const Context = require('./index');

const path = require('path');

class CaCryptoGen {
	constructor(globalConfig, logger) {
		this.globalConfig = globalConfig;
		this.logger = logger || require('khala-logger/log4js').consoleLogger('caCryptoGen');
		this.context = new Context(globalConfig);
	}

	getCaService(port) {
		const caUrl = `${this.globalConfig.TLS ? 'https' : 'http'}://localhost:${port}`;
		const trustedRoots = [];

		return new CA(caUrl, trustedRoots).caService;
	}

	async genUser({userName, password}, orgName) {
		this.logger.debug('genUser', {userName, password, orgName});
		const {config, nodeType} = this.context.findOrgConfig(orgName);
		const caService = await this.getCaService(config.ca.portHost, orgName);

		const cryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
			[nodeType]: {
				org: orgName
			},
			user: {
				name: userName
			},
			password
		});
		const adminCryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
			[nodeType]: {
				org: orgName
			},
			user: {
				name: adminName
			},
			password: adminPwd
		});

		const admin = UserUtil.loadFromLocal(adminCryptoPath, nodeType, config.mspid, true);
		return await genUser(caService, cryptoPath, nodeType, admin, {TLS: this.globalConfig.TLS, affiliationRoot: orgName});

	}

	async genNSaveClientKeyPair(caService, cryptoPath, admin, domain, nodeType) {
		const {key, certificate} = await genClientKeyPair(caService, {
			enrollmentID: `${domain}.client`,
			enrollmentSecret: 'password'
		}, admin, domain);
		const rootDir = path.resolve(cryptoPath[`${nodeType}Org`](), 'client');
		const keyFile = path.resolve(rootDir, 'clientKey');
		const certFile = path.resolve(rootDir, 'clientCert');
		fsExtra.outputFileSync(certFile, certificate);
		const ecdsaKey = new ECDSA_Key(key, fsExtra);
		ecdsaKey.save(keyFile);
	}

	/**
	 * TODO
	 * @param parentCADomain
	 * @param parentCAPort
	 * @param nodeType
	 * @return {Promise<void>}
	 */
	async genIntermediate(parentCADomain, parentCAPort, nodeType) {
		const caService = await this.getCaService(parentCAPort, parentCADomain);
		const mspId = nodeType === 'orderer' ? this.globalConfig.orderer.organizations[parentCADomain].mspid : this.globalConfig.organizations[parentCADomain].mspid;
		const adminCryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
			[nodeType]: {
				org: parentCADomain
			},
			user: {
				name: adminName
			},
			password: adminPwd
		});
		const admin = UserUtil.loadFromLocal(adminCryptoPath, nodeType, mspId, true);
		const enrollmentID = `${adminName}.intermediate`;
		const enrollmentSecret = adminPwd;
		const result = await intermediateCA.register(caService, admin, {
			enrollmentID, enrollmentSecret,
			affiliation: parentCADomain
		});
		this.logger.debug(result);
		return {enrollmentSecret, enrollmentID};
	}

	async genAll() {


		// gen orderers

		const ordererOrgs = this.globalConfig.orderer.organizations;
		for (const domain in ordererOrgs) {
			const ordererConfig = ordererOrgs[domain];
			const mspId = ordererConfig.mspid;

			const caService = await this.getCaService(ordererConfig.ca.portHost, domain);
			const adminCryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
				orderer: {
					org: domain
				},
				user: {
					name: adminName
				},
				password: adminPwd
			});
			const admin = await init(caService, adminCryptoPath, 'orderer', mspId, this.globalConfig.TLS);
			await this.genNSaveClientKeyPair(caService, adminCryptoPath, admin, domain, 'orderer');
			for (const ordererName in ordererConfig.orderers) {

				const cryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
					orderer: {
						org: domain, name: ordererName
					},
					user: {
						name: adminName
					}
				});
				await genOrderer(caService, cryptoPath, admin, {TLS: this.globalConfig.TLS});
			}
		}

		// gen peers
		const peerOrgs = this.globalConfig.organizations;

		for (const domain in peerOrgs) {
			const peerOrgConfig = peerOrgs[domain];
			const mspId = peerOrgConfig.mspid;
			const adminCryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
				peer: {
					org: domain
				},
				user: {
					name: adminName
				},
				password: adminPwd
			});
			const caService = await this.getCaService(peerOrgConfig.ca.portHost, domain);
			const admin = await init(caService, adminCryptoPath, 'peer', mspId, this.globalConfig.TLS);
			await this.genNSaveClientKeyPair(caService, adminCryptoPath, admin, domain, 'peer');
			for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
				const peerName = `peer${peerIndex}`;
				const cryptoPath = new CryptoPath(this.context.CRYPTO_CONFIG_DIR, {
					peer: {
						org: domain, name: peerName
					},
					user: {
						name: adminName
					}
				});
				await genPeer(caService, cryptoPath, admin, {TLS: this.globalConfig.TLS});
			}
		}
	}
}


module.exports = CaCryptoGen;