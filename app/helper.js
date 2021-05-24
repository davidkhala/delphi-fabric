const logger = require('khala-logger/log4js').consoleLogger('Helper');
const globalConfig = require('../config/orgs.json');

const orgsConfig = globalConfig.organizations;
const channelsConfig = globalConfig.channels;
const ordererConfig = globalConfig.orderer;
const Peer = require('../common/nodejs/admin/peer');
const {CryptoPath} = require('../common/nodejs/path');
const path = require('path');
const projectRoot = path.dirname(__dirname);
const projectResolve = (...args) => path.resolve(projectRoot, ...args);
const {adminName} = require('../common/nodejs/formatter/user');
const UserUtil = require('../common/nodejs/user');
const Orderer = require('../common/nodejs/admin/orderer');
const ChannelManager = require('../common/nodejs/admin/channel');
const {homeResolve} = require('khala-light-util');
const {randomKeyOf} = require('khala-light-util/random');
const CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);
const {getClientKeyPairPath} = require('../config/caCryptoGen');

const preparePeer = (orgName, peerIndex, peerConfig) => {
	const {port: peerPort} = peerConfig;

	let peer;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR,
		{peer: {name: `peer${peerIndex}`, org: orgName}});
	const {peerHostName} = cryptoPath;
	if (globalConfig.TLS) {
		const {caCert} = cryptoPath.TLSFile('peer');
		peer = new Peer({host: 'localhost', peerPort, cert: caCert, peerHostName});
	} else {
		peer = new Peer({peerPort});
	}

	return peer;
};

const newOrderer = (name, org, ordererSingleConfig) => {
	const nodeType = 'orderer';
	const ordererPort = ordererSingleConfig.portHost;
	const {portAdmin} = ordererSingleConfig;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		orderer: {
			org, name
		}
	});
	let ordererWrapper;
	if (globalConfig.TLS) {
		const {ordererHostName} = cryptoPath;
		const {caCert} = cryptoPath.TLSFile(nodeType);
		const {clientKey, clientCert} = getClientKeyPairPath(cryptoPath, nodeType);
		ordererWrapper = new Orderer({
			host: 'localhost',
			ordererPort,
			tlsCaCert: caCert,
			ordererHostName,
			clientKey,
			clientCert,
		});
	} else {
		ordererWrapper = new Orderer({ordererPort});
	}
	ordererWrapper.adminAddress = `localhost:${portAdmin}`;
	return ordererWrapper;
};

/**
 *
 * @param {string} [ordererOrgName] orgName filter
 * @return {*[]}
 */
const newOrderers = (ordererOrgName) => {
	const result = [];
	const partialResult = (_ordererOrgName, ordererOrgConfig) => {
		for (const [ordererName, ordererSingleConfig] of Object.entries(ordererOrgConfig.orderers)) {
			const orderer = newOrderer(ordererName, _ordererOrgName, ordererSingleConfig);
			result.push(orderer);
		}
	};
	if (ordererOrgName) {
		partialResult(ordererOrgName, ordererConfig.organizations[ordererOrgName]);
	} else {
		for (const [_ordererOrgName, ordererOrgConfig] of Object.entries(ordererConfig.organizations)) {
			partialResult(_ordererOrgName, ordererOrgConfig);
		}
	}

	return result;
};

/**
 * @param channelName
 * @return {Client.Channel}
 */
const prepareChannel = (channelName) => {
	return new ChannelManager({channelName}).channel;
};

const newPeer = (peerIndex, orgName) => {
	const peerConfig = orgsConfig[orgName].peers[peerIndex];
	return preparePeer(orgName, peerIndex, peerConfig);
};
/**
 *
 * @param {string} [orgName]
 */
const allPeers = (orgName) => {
	let peers = [];
	const partialResult = (_orgName, orgConfig) => {
		const peerIndexes = Object.keys(orgConfig.peers);
		peers = peers.concat(newPeers(peerIndexes, _orgName));
	};
	if (orgName) {
		partialResult(orgName, orgsConfig[orgName]);
	} else {
		for (const [_orgName, orgConfig] of Object.entries(orgsConfig)) {
			partialResult(_orgName, orgConfig);
		}
	}

	return peers;
};
const newPeers = (peerIndexes, orgName) => {
	const targets = [];
	for (const index of peerIndexes) {
		targets.push(newPeer(index, orgName));
	}
	return targets;
};

const findOrgConfig = (orgName, ordererName) => {
	let target;
	let nodeType;
	let portHost;
	if (orgsConfig[orgName]) {
		target = orgsConfig[orgName];
		nodeType = 'peer';
	} else {
		nodeType = 'orderer';
		const {type} = ordererConfig;
		if (ordererConfig[type].organizations[orgName]) {
			target = ordererConfig[type].organizations[orgName];
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
	const {config, nodeType} = findOrgConfig(orgName);
	const mspId = config.mspid;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		[nodeType]: {
			org: orgName
		},
		user: {
			name: username
		}
	});
	return UserUtil.loadFromLocal(cryptoPath, nodeType, mspId);
};

const getOrgAdmin = (orgName, nodeType = 'peer') => {
	if (!orgName) {
		orgName = exports.randomOrg(nodeType);
	}
	logger.debug(`get ${orgName} Admin`);
	return getUser(adminName, orgName);
};
const randomOrg = (nodeType) => {
	let orgName;
	if (nodeType === 'peer') {
		orgName = randomKeyOf(globalConfig.organizations);
	} else if (nodeType === 'orderer') {
		const {type} = globalConfig.orderer;
		orgName = randomKeyOf(globalConfig.orderer[type].organizations);
	} else {
		throw Error(`invalid nodeType ${nodeType}`);
	}
	logger.info(`random ${nodeType} org`, orgName);
	return orgName;
};
const randomChannelOrg = (channelName) => {
	return randomKeyOf(channelsConfig[channelName].organizations);
};

module.exports = {
	projectResolve,
	getUser,
	randomChannelOrg,
	randomOrg,
	getOrgAdmin,
	findOrgConfig,
	newPeer,
	newPeers,
	allPeers,
	newOrderers,
	newOrderer,
	prepareChannel,
};