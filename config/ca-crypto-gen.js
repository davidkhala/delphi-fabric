const caUtil = require('../app/util/ca');

const path = require('path');
const userUtil = require('../app/util/user');
const logger = require('../app/util/logger').new('ca-crypto-gen');
const peerUtil = require('../app/util/peer');
const ordererUtil = require('../app/util/orderer');
const affiliationUtil = require('../app/util/affiliationService');

exports.initAdmin = (url = 'http://localhost:7054', {mspId, domain}, usersDir) => {
	const enrollmentID = 'admin';
	const enrollmentSecret = 'passwd';
	const caService = caUtil.new(url);

	const ordererUserFull = userUtil.formatUsername(enrollmentID, domain);
	if (usersDir) {
		const userMSPRoot = path.resolve(usersDir, ordererUserFull, 'msp');
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
				return userUtil.build(ordererUserFull, result, mspId);
			});
		});
	} else {
		return caService.enroll({enrollmentID, enrollmentSecret}).then((result) => {
			return userUtil.build(ordererUserFull, result, mspId);
		});
	}

};
exports.init = (url = 'http://localhost:7054', {mspId, domain, affiliationRoot = domain}, usersDir) => {
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
exports.genOrderer = (url = 'http://localhost:7054', orderersDir, {ordererName, domain, ordererPort, mspId, affiliationRoot = domain}, usersDir) => {
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
			caUtil.peer.toadmincerts({certificate}, ordererMSPRoot, {username: 'admin', domain});
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

exports.genPeer = (url, peersDir, {peerName, domain, mspId, peerPort, affiliationRoot = domain}, usersDir) => {
	const caService = caUtil.new(url);

	const peer_hostName_full = peerUtil.formatPeerName(peerName, domain);
	const peerMSPRoot = path.resolve(peersDir, peer_hostName_full, 'msp');


	if (peerPort) {
		const peer = peerUtil.loadFromLocal(peerMSPRoot, {peer_hostName_full, peerPort});
		if (peer) {
			logger.info(`crypto exist in ${peerMSPRoot}`);
			return peer;
		}
	} else {
		const isExist = peerUtil.cryptoExistLocal(peerMSPRoot, {peer_hostName_full});
		if (isExist) {
			logger.info(`crypto exist in ${peerMSPRoot}`);
			return true;
		}
	}

	const enrollmentID = peerName;
	const enrollmentSecret = 'passwd';
	return module.exports.initAdmin(url, {mspId, domain}, usersDir)
		.then(admin => {
			const certificate = userUtil.getCertificate(admin);
			caUtil.peer.toadmincerts({certificate}, peerMSPRoot, {username: 'admin', domain});
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
			const orderersDir = path.resolve(caCryptoConfig, 'ordererOrganizations', domain, 'orderers');

			const usersDir = path.resolve(caCryptoConfig, 'ordererOrganizations', domain, 'users');
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
		//TODO
	}
	//gen peers
	const peerOrgs = globalConfig.orgs;
	for (const peerOrg in peerOrgs) {
		const peerOrgConfig = peerOrgs[peerOrg];
		const mspId = peerOrgConfig.MSP.id;
		const domain = `${peerOrg}.${globalConfig.domain}`;
		const caUrl = `http://localhost:${peerOrgConfig.ca.portHost}`;//FIXME: hard code here without tls
		const peersDir = path.resolve(caCryptoConfig, 'peerOrganizations', domain, 'peers');
		const usersDir = path.resolve(caCryptoConfig, 'peerOrganizations', domain, 'users');
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