import path from 'path';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import Peer from '../common/nodejs/admin/peer.js';
import {CryptoPath} from '../common/nodejs/path.js';
import {adminName} from '../common/nodejs/formatter/user.js';
import * as UserUtil from '../common/nodejs/user.js';
import Orderer from '../common/nodejs/admin/orderer.js';
import {emptyChannel} from '../common/nodejs/admin/channel.js';
import {homeResolve} from '@davidkhala/light/path.js';
import {randomKeyOf} from '@davidkhala/light/random.js';
import {getClientKeyPairPath} from '../config/caCryptoGen.js';
import {importFrom, filedirname} from '@davidkhala/light/es6.mjs';

const globalConfig = importFrom(import.meta, '../config/orgs.json',);
const logger = consoleLogger('Helper');
const orgsConfig = globalConfig.organizations;
const channelsConfig = globalConfig.channels;
const ordererConfig = globalConfig.orderer;
filedirname(import.meta);
export const projectRoot = path.dirname(__dirname);
export const projectResolve = (...args) => path.resolve(projectRoot, ...args);

const CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);

export function orgNamesOfChannel(channelName) {
	return Object.keys(globalConfig.channels[channelName].organizations);
}

const preparePeer = (orgName, peerIndex, peerConfig) => {
	const {port: peerPort} = peerConfig;

	let peer;
	const logger = consoleLogger('peer');
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR,
		{peer: {name: `peer${peerIndex}`, org: orgName}});
	if (globalConfig.TLS) {
		const {caCert} = cryptoPath.TLSFile('peer');
		peer = new Peer({host: 'localhost', peerPort, cert: caCert}, logger);
	} else {
		peer = new Peer({peerPort}, logger);
	}

	return peer;
};

export const newOrderer = (name, org, ordererSingleConfig) => {
	const nodeType = 'orderer';
	const ordererPort = ordererSingleConfig.portHost;
	const {portAdmin} = ordererSingleConfig;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		orderer: {
			org, name
		}
	});
	let ordererWrapper;
	const logger = consoleLogger('orderer');
	if (globalConfig.TLS) {
		const {caCert} = cryptoPath.TLSFile(nodeType);
		const {clientKey, clientCert} = getClientKeyPairPath(cryptoPath, nodeType);
		ordererWrapper = new Orderer({
			host: 'localhost',
			ordererPort,
			tlsCaCert: caCert,
			clientKey,
			clientCert,
		}, undefined, logger);
	} else {
		ordererWrapper = new Orderer({ordererPort}, undefined, logger);
	}
	ordererWrapper.adminAddress = `localhost:${portAdmin}`;
	return ordererWrapper;
};

/**
 *
 * @param {string} [ordererOrgName] orgName filter
 * @return {*[]}
 */
export const newOrderers = (ordererOrgName) => {
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
export const prepareChannel = (channelName) => {
	return emptyChannel(channelName);
};

export const newPeer = (peerIndex, orgName) => {
	const peerConfig = orgsConfig[orgName].peers[peerIndex];
	return preparePeer(orgName, peerIndex, peerConfig);
};
/**
 *
 * @param {string} [orgName]
 */
export const allPeers = (orgName) => {
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
export const newPeers = (peerIndexes, orgName) => {
	const targets = [];
	for (const index of peerIndexes) {
		targets.push(newPeer(index, orgName));
	}
	return targets;
};

export const findOrgConfig = (orgName) => {
	let target;
	let nodeType;
	if (orgsConfig[orgName]) {
		target = orgsConfig[orgName];
		nodeType = 'peer';
	} else {
		nodeType = 'orderer';
		if (ordererConfig.organizations[orgName]) {
			target = ordererConfig.organizations[orgName];
		}
	}
	if (!target) {
		throw Error(`${orgName} not found`);
	}
	return {config: target, nodeType};
};
export const findOrgName = (mspId) => {
	let findResult = Object.entries(orgsConfig).find(([_, {mspid}]) => mspid === mspId);
	if (findResult) {
		findResult.push('peer');

	} else {
		findResult = Object.entries(ordererConfig.organizations).find(([_, {mspid}]) => mspid === mspId);
		if (findResult) {
			findResult.push('orderer');
		}
	}
	return findResult;
};
export const getUser = (username, orgName) => {
	const {config: {mspid}, nodeType} = findOrgConfig(orgName);

	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		[nodeType]: {
			org: orgName
		},
		user: {
			name: username
		}
	});
	return UserUtil.loadFromLocal(cryptoPath, nodeType, mspid);
};

export const getOrgAdmin = (orgName, nodeType = 'peer') => {
	if (!orgName) {
		orgName = randomOrg(nodeType);
	}
	logger.debug(`get ${orgName} Admin`);
	return getUser(adminName, orgName);
};
export const randomOrg = (nodeType) => {
	let orgName;
	if (nodeType === 'peer') {
		orgName = randomKeyOf(globalConfig.organizations);
	} else if (nodeType === 'orderer') {
		orgName = randomKeyOf(globalConfig.orderer.organizations);
	} else {
		throw Error(`invalid nodeType ${nodeType}`);
	}
	logger.info(`random ${nodeType} org`, orgName);
	return orgName;
};
export const randomChannelOrg = (channelName) => {
	return randomKeyOf(channelsConfig[channelName].organizations);
};
