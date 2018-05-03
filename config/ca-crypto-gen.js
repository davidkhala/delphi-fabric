const caUtil = require('../app/util/ca');

const path = require('path');
const userUtil = require('../app/util/user');
const pathUtil = require('../app/util/path');
const {CryptoPath} = pathUtil
const logger = require('../app/util/logger').new('ca-crypto-gen');
const peerUtil = require('../app/util/peer');
const ordererUtil = require('../app/util/orderer');
const affiliationUtil = require('../app/util/affiliationService');


exports.initAdmin = (url = 'http://localhost:7054', {mspId, domain}, usersDir) => {
	const enrollmentID = 'Admin';
	const enrollmentSecret = 'passwd';
	const caService = caUtil.new(url);

	const userFull = userUtil.formatUsername(enrollmentID, domain);
	if (usersDir) {
		const userMSPRoot = path.resolve(usersDir, userFull, 'msp');
		return userUtil.loadFromLocal(userMSPRoot, undefined, {username: enrollmentID, domain, mspId}).then((user) => {
			if (user) {
				logger.info('orderer admin found in local');
				return Promise.resolve(user);
			}
			return caService.enroll({enrollmentID, enrollmentSecret}).then((result) => {
				caUtil.user.toMSP(result, userMSPRoot, {username: enrollmentID, domain});
				const base = path.dirname(usersDir);//parent
				const orgMSPDir =path.resolve(base,'msp');
				caUtil.org.toMSP(result,orgMSPDir,{name:enrollmentID,domain});
				return userUtil.build(userFull, result, mspId);
			});
		});
	} else {
		return caService.enroll({enrollmentID, enrollmentSecret}).then((result) => {
			return userUtil.build(userFull, result, mspId);
		});
	}

};
exports.init = (url, {mspId, domain, affiliationRoot = domain}, usersDir) => {
	logger.debug('init', {url, affiliationRoot, mspId, domain, usersDir});
	const ca = caUtil.new(url);
	const affiliationService = ca.newAffiliationService();
	const force = true;//true to create recursively


	return module.exports.initAdmin(url, {mspId, domain}, usersDir).then(adminUser => {
		const promises = [affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.user`, force}, adminUser),
			affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.peer`, force}, adminUser),
			affiliationUtil.creatIfNotExist(affiliationService, {name: `${affiliationRoot}.orderer`, force}, adminUser)];
		return Promise.all(promises).then(() => Promise.resolve(adminUser));
	}).catch(err => {
		logger.error(err);
		return err;
	});

};
exports.genOrderer = (url, orderersDir, {ordererName, domain, ordererPort, mspId, affiliationRoot = domain}, usersDir) => {
	const caService = caUtil.new(url);

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

	const enrollmentID = ordererName;
	const enrollmentSecret = 'passwd';
	return module.exports.initAdmin(url, {mspId, domain}, usersDir)
		.then(admin => {
			const certificate = userUtil.getCertificate(admin);
			caUtil.peer.toadmincerts({certificate}, ordererMSPRoot, {username: 'Admin', domain});
			return caUtil.register(caService, {
				enrollmentID,
				enrollmentSecret,
				role: 'orderer',
				affiliation: `${affiliationRoot}.orderer`
			}, admin).then(() => {
				return caService.enroll({enrollmentID, enrollmentSecret});
			}).then(result => {
				caUtil.peer.toMSP(result, ordererMSPRoot, {peerName: ordererName, domain});
				return Promise.resolve(admin);
			});
		});

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
exports.genPeer = (url, peersDir, {peerName, domain, mspId, peerPort, affiliationRoot = domain}, usersDir) => {
	const caService = caUtil.new(url);

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

	const enrollmentID = peerName;
	const enrollmentSecret = 'passwd';
	return module.exports.initAdmin(url, {mspId, domain}, usersDir)
		.then(admin => {
			const certificate = userUtil.getCertificate(admin);
			caUtil.peer.toadmincerts({certificate}, peerMSPRoot, {username: 'Admin', domain});
			return caUtil.register(caService, {
				enrollmentID,
				enrollmentSecret,
				role: 'peer',
				affiliation: `${affiliationRoot}.peer`
			}, admin);
		}).then(() => {
			return caService.enroll({enrollmentID, enrollmentSecret});
		}).then(result => {
			caUtil.peer.toMSP(result, peerMSPRoot, {peerName, domain});
			return Promise.resolve();
		});

};


exports.genAll = () => {
	const globalConfig = require('../config/orgs');
	const caCryptoConfig = globalConfig.docker.volumes.CACRYPTOROOT.dir;
	const {type} = globalConfig.orderer;
	let promise = Promise.resolve();
	if (type === 'kafka') {
		//gen orderers
		const ordererOrgs = globalConfig.orderer.kafka.orgs;
		for (const domain in ordererOrgs) {
			const ordererConfig = ordererOrgs[domain];
			const mspId = ordererConfig.MSP.id;

			const cryptoPath = new CryptoPath(caCryptoConfig,{
				orderer:{
					org:domain
				},
				user:{
					name:'Admin'
				}
			});
			const orderersDir = cryptoPath.orderers();

			const usersDir = cryptoPath.ordererUsers();
			const caUrl = `http://localhost:${ordererConfig.ca.portHost}`;//FIXME: hard code here without tls
			promise = promise.then(()=>module.exports.init(caUrl, {mspId, domain}, usersDir).then(() => {
				const promises = [];
				for (const ordererName in ordererConfig.orderers) {
					promises.push(module.exports.genOrderer(caUrl, orderersDir, {ordererName, domain, mspId}, usersDir));
				}
				return Promise.all(promises);
			}));


		}

	} else {
		const ordererConfig = globalConfig.orderer.solo;
		const mspId = ordererConfig.MSP.id;

		const domain = ordererConfig.orgName;
		const cryptoPath = new CryptoPath(caCryptoConfig,{
			orderer:{
				org:domain
			},
			user:{
				name:'Admin'
			}
		});
		const orderersDir = cryptoPath.orderers();

		const usersDir = cryptoPath.ordererUsers();
		const caUrl = `http://localhost:${ordererConfig.ca.portHost}`;//FIXME: hard code here without tls
		promise = promise.then(()=>module.exports.init(caUrl, {mspId,domain}, usersDir).then(() => {
			const ordererName =ordererConfig.container_name;
			return module.exports.genOrderer(caUrl, orderersDir, {ordererName, domain, mspId}, usersDir);
		}));
	}
	//gen peers
	const peerOrgs = globalConfig.orgs;
	for (const domain in peerOrgs) {
		const peerOrgConfig = peerOrgs[domain];
		const mspId = peerOrgConfig.MSP.id;
		const caUrl = `http://localhost:${peerOrgConfig.ca.portHost}`;//FIXME: hard code here without tls
		const cryptoPath = new CryptoPath(caCryptoConfig,{
			peer:{
				org:domain
			},
			user:{
				name:'Admin'
			}
		});
		const peersDir = cryptoPath.peers();
		const usersDir = cryptoPath.peerUsers();
		promise = promise.then(()=>module.exports.init(caUrl, {mspId, domain}, usersDir).then(() => {
			const promises = [];
			for (let peerIndex = 0; peerIndex < peerOrgConfig.peers.length; peerIndex++) {
				const peerName = `peer${peerIndex}`;
				promises.push(module.exports.genPeer(caUrl, peersDir, {peerName, domain, mspId}, usersDir));
			}
			return Promise.all(promises);
		}));


	}
};