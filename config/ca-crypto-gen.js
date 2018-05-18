const caUtil = require('../common/nodejs/ca');

const path = require('path');
const userUtil = require('../common/nodejs/user');
const pathUtil = require('../common/nodejs/path');
const dockerCmd = require('../common/docker/nodejs/dockerCmd');
const {CryptoPath} = pathUtil;
const logger = require('../common/nodejs/logger').new('ca-crypto-gen');
const peerUtil = require('../common/nodejs/peer');
const ordererUtil = require('../common/nodejs/orderer');
const affiliationUtil = require('../common/nodejs/affiliationService');
const globalConfig = require('../config/orgs');
const {TLS} = globalConfig;

exports.initAdmin = async (url, {mspId, domain}, usersDir) => {
	logger.debug('initAdmin');
	const enrollmentID = 'Admin';
	const enrollmentSecret = 'passwd';
	const caService = await getCaService(url, domain);

	const userFull = userUtil.formatUsername(enrollmentID, domain);
	if (usersDir) {
		const userMSPRoot = path.resolve(usersDir, userFull, 'msp');
		const user = await userUtil.loadFromLocal(userMSPRoot, undefined, {username: enrollmentID, domain, mspId});
		if (user) {
			logger.info(`${domain} admin found in local`);
			return user;
		}
		const result = await caService.enroll({enrollmentID, enrollmentSecret});
		caUtil.user.toMSP(result, userMSPRoot, {username: enrollmentID, domain});
		const base = path.dirname(usersDir);
		const orgMSPDir = path.resolve(base, 'msp');
		caUtil.org.toMSP(result, orgMSPDir, {name: enrollmentID, domain});
		return userUtil.build(userFull, result, mspId);
	} else {
		const result = await caService.enroll({enrollmentID, enrollmentSecret});
		return userUtil.build(userFull, result, mspId);
	}

};
const getCaService = async (url, domain) => {
	if (TLS) {
		const container_name = `ca.${domain}`;
		const from = caUtil.container.caCert;
		const to = `${container_name}-cert.pem`;
		await dockerCmd.copy(container_name, from, to);
		const pem = fs.readFileSync(to).toString();
		return caUtil.new(url, [pem]);
	}
	return caUtil.new(url);
};
exports.init = async (url, {mspId, domain, affiliationRoot = domain}, usersDir) => {
	logger.debug('init', {url, affiliationRoot, mspId, domain, usersDir});
	const ca = await getCaService(url, domain);
	const affiliationService = ca.newAffiliationService();
	const force = true;//true to create recursively


	const adminUser = await exports.initAdmin(url, {mspId, domain}, usersDir);
	const promises = [affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.user`, force}, adminUser),
		affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.peer`, force}, adminUser),
		affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.orderer`, force}, adminUser)];
	await Promise.all(promises);
	return adminUser;

};
exports.genOrderer = async (url, orderersDir, {ordererName, domain, ordererPort, mspId, affiliationRoot = domain}, usersDir) => {
	const caService = await getCaService(url, domain);

	const orderer_hostName_full = peerUtil.formatPeerName(ordererName, domain);
	const ordererMSPRoot = path.resolve(orderersDir, orderer_hostName_full, 'msp');


	if (ordererPort) {
		const orderer = ordererUtil.loadFromLocal(ordererMSPRoot, {orderer_hostName_full, ordererPort});
		if (orderer) {
			logger.info(`crypto exist in ${ordererMSPRoot}`);
			return orderer;
		}
	} else {
		const isExist = ordererUtil.cryptoExistLocal(ordererMSPRoot, {orderer_hostName_full});
		if (isExist) {
			logger.info(`crypto exist in ${ordererMSPRoot}`);
			return true;
		}
	}

	const enrollmentID = orderer_hostName_full;
	const enrollmentSecret = 'passwd';
	const admin = await exports.initAdmin(url, {mspId, domain}, usersDir);
	const certificate = userUtil.getCertificate(admin);
	caUtil.peer.toadmincerts({certificate}, ordererMSPRoot, {username: 'Admin', domain});
	await caUtil.register(caService, {
		enrollmentID,
		enrollmentSecret,
		role: 'orderer',
		affiliation: `${affiliationRoot}.orderer`
	}, admin);

	const result = await caService.enroll({enrollmentID, enrollmentSecret});
	caUtil.peer.toMSP(result, ordererMSPRoot, {peerName: ordererName, domain});
	if(TLS){
		const tlsResult = await caService.enroll({enrollmentID,enrollmentSecret,profile:'tls'});
		const tlsDir = path.resolve(orderersDir,orderer_hostName_full,'tls');
		caUtil.toTLS(tlsResult,tlsDir);
	}
	return admin;

};
/**
 *
 * @param url
 * @param peersDir
 * @param peerName
 * @param domain
 * @param mspId
 * @param peerPort
 * @param affiliationRoot
 * @param usersDir required to allign admin cert
 * @returns {*}
 */
exports.genPeer = async (url, peersDir, {peerName, domain, mspId, peerPort, affiliationRoot = domain}, usersDir) => {
	const caService = await getCaService(url, domain);

	const peer_hostName_full = peerUtil.formatPeerName(peerName, domain);
	const peerMSPRoot = path.resolve(peersDir, peer_hostName_full, 'msp');


	if (peerPort) {
		const peer = peerUtil.loadFromLocal(peerMSPRoot, {peer_hostName_full, peerPort});
		if (peer) {
			logger.info(`crypto exist in ${peerMSPRoot}`);
			return Promise.resolve(peer);
		}
	} else {
		const isExist = peerUtil.cryptoExistLocal(peerMSPRoot, {peer_hostName_full});
		if (isExist) {
			logger.info(`crypto exist in ${peerMSPRoot}`);
			return Promise.resolve();
		}
	}

	const enrollmentID = peer_hostName_full;
	const enrollmentSecret = 'passwd';
	const admin = await exports.initAdmin(url, {mspId, domain}, usersDir);
	const certificate = userUtil.getCertificate(admin);
	caUtil.peer.toadmincerts({certificate}, peerMSPRoot, {username: 'Admin', domain});
	await caUtil.register(caService, {
		enrollmentID,
		enrollmentSecret,
		role: 'peer',
		affiliation: `${affiliationRoot}.peer`
	}, admin);
	const result = await caService.enroll({enrollmentID, enrollmentSecret});
	caUtil.peer.toMSP(result, peerMSPRoot, {peerName, domain});
	if(TLS){
		const tlsResult = await caService.enroll({enrollmentID,enrollmentSecret,profile:'tls'});
		const tlsDir = path.resolve(peersDir,peer_hostName_full,'tls');
		caUtil.toTLS(tlsResult,tlsDir);
	}

};


exports.genAll = async () => {

	const caCryptoConfig = globalConfig.docker.volumes.MSPROOT.dir;
	const {type} = globalConfig.orderer;
	const protocol = TLS ? 'https' : 'http';

	if (type === 'kafka') {
		//gen orderers
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
			const orderersDir = cryptoPath.orderers();
			const usersDir = cryptoPath.ordererUsers();
			const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
			await module.exports.init(caUrl, {mspId, domain}, usersDir);

			const promises = [];
			for (const ordererName in ordererConfig.orderers) {
				promises.push(module.exports.genOrderer(caUrl, orderersDir, {ordererName, domain, mspId}, usersDir));
			}
			await Promise.all(promises);


		}

	} else {
		const ordererConfig = globalConfig.orderer.solo;
		const mspId = ordererConfig.MSP.id;

		const domain = ordererConfig.orgName;
		const cryptoPath = new CryptoPath(caCryptoConfig, {
			orderer: {
				org: domain
			},
			user: {
				name: 'Admin'
			}
		});
		const orderersDir = cryptoPath.orderers();

		const usersDir = cryptoPath.ordererUsers();
		const caUrl = `${protocol}://localhost:${ordererConfig.ca.portHost}`;
		await module.exports.init(caUrl, {mspId, domain}, usersDir);
		const ordererName = ordererConfig.container_name;
		await module.exports.genOrderer(caUrl, orderersDir, {ordererName, domain, mspId}, usersDir);
	}
	//gen peers
	const peerOrgs = globalConfig.orgs;
	for (const domain in peerOrgs) {
		const peerOrgConfig = peerOrgs[domain];
		const mspId = peerOrgConfig.MSP.id;
		const caUrl = `${protocol}://localhost:${peerOrgConfig.ca.portHost}`;
		const cryptoPath = new CryptoPath(caCryptoConfig, {
			peer: {
				org: domain
			},
			user: {
				name: 'Admin'
			}
		});
		const peersDir = cryptoPath.peers();
		const usersDir = cryptoPath.peerUsers();
		await module.exports.init(caUrl, {mspId, domain}, usersDir);
		const promises = [];
		for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
			const peerName = `peer${peerIndex}`;
			promises.push(module.exports.genPeer(caUrl, peersDir, {peerName, domain, mspId}, usersDir));
		}
		await Promise.all(promises);
	}
};