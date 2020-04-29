const logger = require('khala-logger/log4js').consoleLogger('Helper');
const globalConfig = require('../config/orgs.json');

const orgsConfig = globalConfig.orgs;
const channelsConfig = globalConfig.channels;
const ordererConfig = globalConfig.orderer;
const ClientManager = require('../common/nodejs/builder/client');
const peerUtil = require('../common/nodejs/builder/peer');
const {CryptoPath} = require('../common/nodejs/path');
const path = require('path');
const projectRoot = path.dirname(__dirname);
const projectResolve = (...args) => path.resolve(projectRoot, ...args);
const UserUtil = require('../common/nodejs/user');
const {adminName:defaultAdminName,adminPwd:defaultAdminPwd} = require('../common/nodejs/formatter/user');
const Orderer = require('../common/nodejs/builder/orderer');
const channelUtil = require('../common/nodejs/builder/channel');
const {homeResolve} = require('khala-nodeutils/helper');
const {randomKeyOf} = require('khala-nodeutils/random');
const CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);

const preparePeer = (orgName, peerIndex, peerConfig) => {
	const {port: peerPort} = peerConfig;

	let peer;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR,
		{peer: {name: `peer${peerIndex}`, org: orgName}});
	const {peerHostName} = cryptoPath;
	if (globalConfig.TLS) {
		const {cert} = cryptoPath.TLSFile('peer');
		peer = new peerUtil({host: 'localhost', peerPort, cert, peerHostName}).peer;
	} else {
		peer = new peerUtil({peerPort}).peer;
	}
	// NOTE append more info
	peer.peerConfig = peerConfig;

	peer.peerConfig.orgName = orgName;
	peer.peerConfig.peerIndex = peerIndex;
	return peer;
};
exports.toLocalhostOrderer = (orderer) => {
	const url = orderer.getUrl();
	const {type} = ordererConfig;
	for (const [ordererOrgName, ordererOrgConfig] of Object.entries(ordererConfig[type].orgs)) {
		const found = Object.keys(ordererOrgConfig.orderers).find((ordererName) => {
			return url.includes(ordererName);
		});
		if (found) {
			return newOrderer(found, ordererOrgName, ordererOrgConfig.orderers[found]);
		}
	}
	return null;
};
const newOrderer = (name, org, ordererSingleConfig) => {
	const nodeType = 'orderer';
	const ordererPort = ordererSingleConfig.portHost;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		orderer: {
			org, name
		}
	});
	let orderer;
	if (globalConfig.TLS) {
		const {ordererHostName} = cryptoPath;
		const {caCert} = cryptoPath.TLSFile(nodeType);
		orderer = new Orderer({
			host: 'localhost',
			ordererPort,
			cert: caCert,
			ordererHostName
		}).orderer;
	} else {
		orderer = new Orderer({ordererPort}).orderer;
	}
	orderer.org = org;
	orderer.name = name;
	return orderer;
};

exports.newOrderers = () => {
	const result = [];
	const {type} = ordererConfig;
	for (const [ordererOrgName, ordererOrgConfig] of Object.entries(ordererConfig[type].orgs)) {
		for (const ordererName in ordererOrgConfig.orderers) {
			const ordererSingleConfig = ordererOrgConfig.orderers[ordererName];
			const orderer = newOrderer(ordererName, ordererOrgName, ordererSingleConfig);
			result.push(orderer);
		}
	}
	return result;
};

/**
 *
 * @param channelName default to system channel
 * @param client
 * @return {Client.Channel}
 */
exports.prepareChannel = (channelName, client) => {
	return new channelUtil({client, channelName}).channel;
};

exports.newPeer = (peerIndex, orgName) => {
	const peerConfig = orgsConfig[orgName].peers[peerIndex];
	return preparePeer(orgName, peerIndex, peerConfig);
};
exports.allPeers = () => {
	let peers = [];
	for (const [orgName, orgConfig] of Object.entries(orgsConfig)) {
		const peerIndexes = Object.keys(orgConfig.peers);
		peers = peers.concat(exports.newPeers(peerIndexes, orgName));
	}
	return peers;
};
exports.newPeers = (peerIndexes, orgName) => {
	const targets = [];
	for (const index of peerIndexes) {
		targets.push(exports.newPeer(index, orgName));
	}
	return targets;

};

exports.findOrgConfig = (orgName, ordererName) => {
	let target;
	let nodeType;
	let portHost;
	if (orgsConfig[orgName]) {
		target = orgsConfig[orgName];
		nodeType = 'peer';
	} else {
		nodeType = 'orderer';
		const {type} = ordererConfig;
		if (ordererConfig[type].orgs[orgName]) {
			target = ordererConfig[type].orgs[orgName];
			if (!ordererName) {
				ordererName = randomKeyOf(target.orderers);
			}
			portHost = target.orderers[ordererName].portHost;
		}
	}
	if (!target) {
		throw Error(`${orgName} not found`);
	}
	return {config: target, portHost, nodeType};
};
const getUser = (username, orgName) => {
	const {config, nodeType} = exports.findOrgConfig(orgName);
	const mspId = config.mspid;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		[nodeType]: {
			org: orgName
		},
		user: {
			name: username
		}
	});
	// FIXME this._signingIdentity._signer._key.getSKI is not a function
	return UserUtil.loadFromLocal(cryptoPath, nodeType, mspId);
};
exports.getUser = getUser;

const getUserClient = (username, orgName, client) => {
	const user = getUser(username, orgName);
	ClientManager.setUser(client, user);
	return client;
};

exports.getOrgAdminUser = (orgName, cryptoSuite) => {
	return getUser(defaultAdminName, orgName, cryptoSuite);
};
/**
 * @param orgName
 * @param nodeType
 * @return {Client}
 */
exports.getOrgAdmin = (orgName, nodeType = 'peer') => {
	const client = new ClientManager().client;
	if (!orgName) {
		orgName = exports.randomOrg(nodeType);
	}
	logger.debug(`get ${orgName} Admin`);
	return getUserClient(defaultAdminName, orgName, client);
};
exports.randomOrg = (nodeType) => {
	let orgName;
	if (nodeType === 'peer') {
		orgName = randomKeyOf(globalConfig.orgs);
	} else if (nodeType === 'orderer') {
		const {type} = globalConfig.orderer;
		orgName = randomKeyOf(globalConfig.orderer[type].orgs);
	} else {
		throw Error(`invalid nodeType ${nodeType}`);
	}
	logger.info(`random ${nodeType} org`, orgName);
	return orgName;
};
exports.randomChannelOrg = (channelName) => {
	return randomKeyOf(channelsConfig[channelName].orgs);
};
exports.projectResolve = projectResolve;
