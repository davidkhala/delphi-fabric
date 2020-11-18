const logger = require('khala-logger/log4js').consoleLogger('Helper');

const ClientManager = require('khala-fabric-sdk-node-builder/client');
const peerUtil = require('khala-fabric-sdk-node-builder/peer');
const {CryptoPath} = require('khala-fabric-sdk-node/path');

const UserUtil = require('khala-fabric-sdk-node/user');
const {adminName: defaultAdminName} = require('khala-fabric-formatter/user');
const Orderer = require('khala-fabric-sdk-node-builder/orderer');
const channelUtil = require('khala-fabric-sdk-node-builder/channel');
const {homeResolve} = require('khala-light-util');
const {randomKeyOf} = require('khala-nodeutils/random');

class Context {

	constructor(globalConfig) {
		this.globalConfig = globalConfig;
		this.orgsConfig = globalConfig.organizations;
		this.channelsConfig = globalConfig.channels;
		this.ordererConfig = globalConfig.orderer;
		this.CRYPTO_CONFIG_DIR = homeResolve(globalConfig.docker.volumes.MSPROOT);
		this.CONFIGTX_DIR = homeResolve(this.globalConfig.docker.volumes.CONFIGTX);
	}


	newPeer(peerIndex, orgName) {
		const peerConfig = this.orgsConfig[orgName].peers[peerIndex];
		return this.preparePeer(orgName, peerIndex, peerConfig);
	}

	preparePeer(orgName, peerIndex, peerConfig) {
		const {port: peerPort} = peerConfig;

		let peer;
		const cryptoPath = new CryptoPath(this.CRYPTO_CONFIG_DIR,
			{peer: {name: `peer${peerIndex}`, org: orgName}});
		const {peerHostName} = cryptoPath;
		if (this.globalConfig.TLS) {
			const {cert} = cryptoPath.TLSFile('peer');
			peer = new peerUtil({host: 'localhost', peerPort, cert, peerHostName}).peer;
		} else {
			peer = new peerUtil({peerPort}).peer;
		}
		return peer;
	}

	newOrderer(name, org, ordererSingleConfig) {
		const nodeType = 'orderer';
		const ordererPort = ordererSingleConfig.portHost;
		const cryptoPath = new CryptoPath(this.CRYPTO_CONFIG_DIR, {
			orderer: {
				org, name
			}
		});
		let orderer;
		if (this.globalConfig.TLS) {
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
		return orderer;
	}

	toLocalhostOrderer(orderer) {
		const url = orderer.getUrl();
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(this.ordererConfig.organizations)) {
			const found = Object.keys(ordererOrgConfig.orderers).find((ordererName) => {
				return url.includes(ordererName);
			});
			if (found) {
				return this.newOrderer(found, ordererOrgName, ordererOrgConfig.orderers[found]);
			}
		}
		return null;
	}

	newOrderers() {
		const result = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(this.ordererConfig.organizations)) {
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererSingleConfig = ordererOrgConfig.orderers[ordererName];
				const orderer = this.newOrderer(ordererName, ordererOrgName, ordererSingleConfig);
				result.push(orderer);
			}
		}
		return result;
	}

	/**
	 *
	 * @param channelName default to system channel
	 * @param client
	 * @return {Client.Channel}
	 */
	static prepareChannel(channelName, client) {
		return new channelUtil({client, channelName}).channel;
	}

	allPeers() {
		let peers = [];
		for (const orgName of Object.keys(this.orgsConfig)) {
			peers = peers.concat(this.newPeers(undefined, orgName));
		}
		return peers;
	}

	newPeers(peerIndexes, orgName) {
		if (!peerIndexes) {
			peerIndexes = Object.keys(this.orgsConfig[orgName].peers);
		}
		const targets = [];
		for (const index of peerIndexes) {
			targets.push(this.newPeer(index, orgName));
		}
		return targets;
	}

	getUser(username, orgName) {
		const {config, nodeType} = this.findOrgConfig(orgName);
		const mspId = config.mspid;
		const cryptoPath = new CryptoPath(this.CRYPTO_CONFIG_DIR, {
			[nodeType]: {
				org: orgName
			},
			user: {
				name: username
			}
		});
		return UserUtil.loadFromLocal(cryptoPath, nodeType, mspId, true);
	}

	findOrgConfig(orgName, ordererName) {
		let target;
		let nodeType;
		let portHost;
		if (this.orgsConfig[orgName]) {
			target = this.orgsConfig[orgName];
			nodeType = 'peer';
		} else {
			nodeType = 'orderer';
			target = this.ordererConfig.organizations[orgName];
			if (target) {
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
	}

	randomChannelOrg(channelName) {
		return randomKeyOf(this.channelsConfig[channelName].organizations);
	}


	getUserClient(username, orgName, client) {
		const user = this.getUser(username, orgName);
		ClientManager.setUser(client, user);
		return client;
	}

	/**
	 * @param [orgName]
	 * @param [nodeType]
	 * @return {Client}
	 */
	getOrgAdmin(orgName, nodeType = 'peer') {
		const client = new ClientManager().client;
		if (!orgName) {
			orgName = this.randomOrg(nodeType);
		}
		logger.debug(`get ${orgName} Admin`);
		return this.getUserClient(defaultAdminName, orgName, client);
	}

	randomOrg(nodeType) {
		let orgName;
		if (nodeType === 'peer') {
			orgName = randomKeyOf(this.orgsConfig);
		} else if (nodeType === 'orderer') {
			orgName = randomKeyOf(this.ordererConfig.organizations);
		} else {
			throw Error(`invalid nodeType ${nodeType}`);
		}
		logger.info(`random ${nodeType} org`, orgName);
		return orgName;
	}

}

module.exports = Context;
