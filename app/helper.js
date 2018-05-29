const logger = require('../common/nodejs/logger').new('Helper');
const globalConfig = require('../config/orgs.json');

const orgsConfig = globalConfig.orgs;
const CRYPTO_CONFIG_DIR = globalConfig.docker.volumes.MSPROOT.dir;
const channelsConfig = globalConfig.channels;
const ordererConfig = globalConfig.orderer;
const ClientUtil = require('../common/nodejs/client');
const EventHubUtil = require('../common/nodejs/eventHub');
const peerUtil = require('../common/nodejs/peer');
const pathUtil = require('../common/nodejs/path');
const userUtil = require('../common/nodejs/user');
const OrdererUtil = require('../common/nodejs/orderer');
const channelUtil = require('../common/nodejs/channel');
const {CryptoPath} = pathUtil;


// peerConfig: "portMap": [{	"host": 8051,		"container": 7051},{	"host": 8053,		"container": 7053}]
const preparePeer = (orgName, peerIndex, peerConfig) => {
	let peerPort;
	let eventHubPort;
	for (const portMapEach of peerConfig.portMap) {
		if (portMapEach.container === 7051) {
			peerPort = portMapEach.host;
		}
		if (portMapEach.container === 7053) {
			eventHubPort = portMapEach.host;
		}
	}
	let peer;
	if (globalConfig.TLS) {

		const nodeType = 'peer';
		const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR,
			{peer: {name: `peer${peerIndex}`, org: orgName}});
		const {peerHostName} = cryptoPath;
		const {caCert} = cryptoPath.TLSFile(nodeType);
		peer = peerUtil.new({peerPort, cert: caCert, peerHostName});
	} else {
		peer = peerUtil.new({peerPort});
	}
	//NOTE append more info
	peer.peerConfig = peerConfig;

	peer.peerConfig.eventHub = {
		port: eventHubPort,
		clientPromise: exports.getOrgAdmin(orgName),
	};
	peer.peerConfig.orgName = orgName;
	peer.peerConfig.peerIndex = peerIndex;
	return peer;
};


/**

 * @param client
 * @param channelName
 * @param isRenew
 */
exports.prepareChannel = (channelName, client, isRenew) => {

	const channelConfig = channelsConfig[channelName];
	channelUtil.nameMatcher(channelName, true);

	if (isRenew) {
		delete client._channels[channelName];
	} else {
		if (client._channels[channelName]) return client._channels[channelName];
	}

	const channel = client.newChannel(channelName);//NOTE throw exception if exist
	const newOrderer = (ordererName, domain, ordererSingleConfig) => {
		const nodeType = 'orderer';
		const ordererPort = ordererSingleConfig.portHost;
		const cryptoPath = new CryptoPath(CRYPTO_CONFIG_DIR, {
			orderer: {
				org: domain, name: ordererName
			}
		});
		if (globalConfig.TLS) {
			const {ordererHostName} = cryptoPath;
			const {caCert} = cryptoPath.TLSFile(nodeType);
			return OrdererUtil.new({
				ordererPort,
				cert: caCert,
				ordererHostName
			});
		} else {
			return OrdererUtil.new({ordererPort});
		}

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

	for (const orgName in channelConfig.orgs) {
		const orgConfigInChannel = channelConfig.orgs[orgName];
		for (const peerIndex of orgConfigInChannel.peerIndexes) {
			const peerConfig = orgsConfig[orgName].peers[peerIndex];

			const peer = preparePeer(orgName, peerIndex, peerConfig);
			channel.addPeer(peer);

		}
	}
	channel.eventWaitTime = channelsConfig[channelName].eventWaitTime;
	channel.orgs = channelsConfig[channelName].orgs;
	return channel;
};

exports.newPeers = (peerIndexes, orgName) => {

// work as a data adapter, containerNames: array --> orgname,peerIndex,peerConfig for each newPeer
	const targets = [];
	// find the peer that match the urls
	for (const index of peerIndexes) {

		const peerConfig = orgsConfig[orgName].peers[index];
		if (!peerConfig) continue;
		const peer = preparePeer(orgName, index, peerConfig);
		targets.push(peer);
	}
	return targets;

};
/**
 *  NOTE newEventHub binds to clientContext
 *  eventhub error { Error: event message must be properly signed by an identity from the same organization as the peer}
 * @param richPeer
 * @param client
 */
const bindEventHub = (richPeer, client) => {

	const eventHubPort = richPeer.peerConfig.eventHub.port;
	const pem = richPeer.pem;
	const peerHostName = richPeer._options['grpc.ssl_target_name_override'];
	return EventHubUtil.new(client, {eventHubPort, pem, peerHostName});

};
const getMspID = (orgName) => {
	let target;
	let nodeType;
	if (orgsConfig[orgName]) {
		target = orgsConfig[orgName];
		nodeType = 'peer';
	} else {
		nodeType = 'orderer';
		if (ordererConfig.type === 'kafka') {
			if (ordererConfig.kafka.orgs[orgName]) {
				target = ordererConfig.kafka.orgs[orgName];
			}
		} else {
			if (ordererConfig.solo.orgName === orgName) {
				target = ordererConfig.solo;
			}
		}
	}
	if (!target) throw `${orgName} not found`;
	return {mspId: target.MSP.id, nodeType};
};

const rawAdminUsername = 'Admin';

const getUserClient = async (username, orgName, client) => {
	const {mspId, nodeType} = getMspID(orgName);
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


const getAdminClient = (orgName) => {
	const client = ClientUtil.new();
	return getUserClient(rawAdminUsername, orgName, client);
};

exports.preparePeer = preparePeer;
exports.bindEventHub = bindEventHub;
exports.getOrgAdmin = getAdminClient;
exports.JSONReadable = (data) => JSON.stringify(data, null, 2);