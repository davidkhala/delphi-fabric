const logger = require('../common/nodejs/logger').new('Helper');
const globalConfig = require('../config/orgs.json');

const orgsConfig = globalConfig.orgs;
const channelsConfig = globalConfig.channels;
const ordererConfig = globalConfig.orderer;
const ClientUtil = require('../common/nodejs/client');
const peerUtil = require('../common/nodejs/peer');
const {CryptoPath} = require('../common/nodejs/path');
const path = require('path');
const projectRoot = path.dirname(__dirname);
const projectResolve = (...args) => path.resolve(projectRoot, ...args);
const CRYPTO_CONFIG_DIR = projectResolve(globalConfig.docker.volumes.MSPROOT.dir);
const userUtil = require('../common/nodejs/user');
const OrdererUtil = require('../common/nodejs/orderer');
const channelUtil = require('../common/nodejs/channel');
const {randomKeyOf} = require('khala-nodeutils/helper');

exports.preparePeer = (orgName, peerIndex, peerConfig) => {
	const {port: peerPort} = peerConfig;

	let peer;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR,
		{peer: {name: `peer${peerIndex}`, org: orgName}});
	const {peerHostName} = cryptoPath;
	if (globalConfig.TLS) {
		const {caCert} = cryptoPath.TLSFile('peer');
		peer = peerUtil.new({peerPort, cert: caCert, peerHostName});
	} else {
		peer = peerUtil.new({peerPort});
	}
	//NOTE append more info
	peer.peerConfig = peerConfig;

	peer.peerConfig.orgName = orgName;
	peer.peerConfig.peerIndex = peerIndex;
	return peer;
};


/**
 * @param client
 * @param channelName default to system channel
 * @param isRenew
 */
exports.prepareChannel = (channelName, client, isRenew) => {

	if (isRenew) {
		delete client._channels[channelName];
	} else {
		if (client._channels[channelName]) return client._channels[channelName];
	}

	const channel = channelUtil.new(client, channelName);
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
			orderer = OrdererUtil.new({
				ordererPort,
				cert: caCert,
				ordererHostName
			});
		} else {
			orderer = OrdererUtil.new({ordererPort});
		}
		orderer.org = org;
		orderer.name = name;
		return orderer;
	};
	if (ordererConfig.type === 'kafka') {
		for (const ordererOrgName in ordererConfig.kafka.orgs) {
			const ordererOrgConfig = ordererConfig.kafka.orgs[ordererOrgName];
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererSingleConfig = ordererOrgConfig.orderers[ordererName];
				const orderer = newOrderer(ordererName, ordererOrgName, ordererSingleConfig);
				channel.addOrderer(orderer);
			}

		}
	} else {

		const orderer = newOrderer(ordererConfig.solo.container_name, ordererConfig.solo.orgName, ordererConfig.solo);
		channel.addOrderer(orderer);
	}

	if (channelName && channelName !== channelUtil.genesis) {
		const channelConfig = channelsConfig[channelName];

		for (const orgName in channelConfig.orgs) {
			const orgConfigInChannel = channelConfig.orgs[orgName];
			for (const peerIndex of orgConfigInChannel.peerIndexes) {
				const peerConfig = orgsConfig[orgName].peers[peerIndex];

				const peer = exports.preparePeer(orgName, peerIndex, peerConfig);
				channel.addPeer(peer);

			}
		}
		channel.eventWaitTime = channelConfig.eventWaitTime;
		channel.orgs = channelConfig.orgs;
	}

	return channel;
};

/**
 * work as a data adapter, containerNames: array --> orgname,peerIndex,peerConfig for each newPeer
 * @param {number[]} peerIndexes
 * @param {string} orgName
 * @returns {Peer[]}
 */
exports.newPeers = (peerIndexes, orgName) => {


	const targets = [];
	// find the peer that match the urls
	for (const index of peerIndexes) {

		const peerConfig = orgsConfig[orgName].peers[index];
		if (!peerConfig) continue;
		const peer = exports.preparePeer(orgName, index, peerConfig);
		targets.push(peer);
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
		if (ordererConfig.type === 'kafka') {
			if (ordererConfig.kafka.orgs[orgName]) {
				target = ordererConfig.kafka.orgs[orgName];
				if (!ordererName) {
					ordererName = randomKeyOf(target.orderers);
				}
				portHost = target.orderers[ordererName].portHost;
			}
		} else {
			if (ordererConfig.solo.orgName === orgName) {
				target = ordererConfig.solo;
				portHost = target.portHost;
			}
		}
	}
	if (!target) throw `${orgName} not found`;
	return {config: target, portHost, nodeType};
};

const getUserClient = async (username, orgName, client) => {
	const {config, nodeType} = exports.findOrgConfig(orgName);
	const mspId = config.MSP.id;
	const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
		[nodeType]: {
			org: orgName
		},
		user: {
			name: username
		}
	});
	const user = await userUtil.loadFromLocal(cryptoPath, nodeType, mspId, client.getCryptoSuite());
	//FIXME this._signingIdentity._signer._key.getSKI is not a function
	await client.setUserContext(user, true);
	return client;
};


exports.getOrgAdmin = (orgName, nodeType) => {
	const client = ClientUtil.new();
	if (!orgName) {
		orgName = exports.randomOrg(nodeType);
	}
	logger.debug(`get ${orgName} Admin`);
	return getUserClient(userUtil.adminName, orgName, client);
};
exports.randomOrg = (nodeType) => {
	let orgName;
	if (nodeType === 'peer') {
		orgName = randomKeyOf(globalConfig.orgs);
	} else if (nodeType === 'orderer') {
		if (globalConfig.orderer.type === 'solo') {
			orgName = globalConfig.orderer.solo.orgName;
		} else {
			orgName = randomKeyOf(globalConfig.orderer.kafka.orgs);
		}
	} else {
		throw `invalid nodeType ${nodeType}`;
	}
	logger.info(`random ${nodeType} org`, orgName);
	return orgName;
};
exports.randomChannelOrg = (channelName) => {
	return randomKeyOf(channelsConfig[channelName].orgs);
};
exports.projectResolve = projectResolve;