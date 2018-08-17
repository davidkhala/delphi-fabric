const BaseApp = require('../common/nodejs/express/baseApp');
const router = BaseApp.getRouter();
const logger = require('../common/nodejs/logger').new('router signature');
const signUtil = require('../common/nodejs/multiSign');
const EventHubUtil = require('../common/nodejs/eventHub');
const {channelUpdate, ConfigFactory, getChannelConfigReadable} = require('../common/nodejs/configtxlator');
const {nodeList, prune: {nodes: pruneNodes}} = require('../common/docker/nodejs/dockerode-util');
const helper = require('../app/helper');
const Multer = require('multer');
const fs = require('fs');
const {port: signServerPort} = require('./swarm.json').signServer;
const {cache, port: swarmServerPort} = require('./swarm.json').swarmServer;
const {homeResolve} = require('../common/nodejs/path');
const multerCache = Multer({dest: homeResolve(cache)});
const {RequestPromise, getSignatures} = require('../common/nodejs/express/serverClient');

const channelUtil = require('../common/nodejs/channel');
const {sha2_256} = require('../common/nodejs/helper');

router.post('/getSwarmSignatures', multerCache.single('proto'), async (req, res) => {
	try {
		if (!req.file) throw 'no attachment found';
		const protoPath = req.file.path;

		const proto = fs.readFileSync(protoPath);
		logger.debug('proto hash ', sha2_256(proto));

		await pruneNodes();
		const nodes = await nodeList(true);
		const ips = nodes.map(node => node.Status.Addr);

		logger.debug({ips});
		const promises = ips.map(async (ip) => {
			const url = `http://${ip}:${signServerPort}`;
			try {
				const resp = await getSignatures(url, protoPath);
				logger.info('success to getSignatures from', url);
				return resp.signatures;
			} catch (e) {
				logger.error('failed to getSignatures from', url, e);
				//TODO error tolerance;
				return [];
			}
		});
		const resp = await Promise.all(promises);

		//resp is array of array
		let joinedArray = [];
		for (const eachResp of resp) {
			if (Array.isArray(eachResp)) {
				joinedArray = joinedArray.concat(eachResp);
			}
		}
		res.send({signatures: joinedArray});

	} catch (err) {
		logger.error(err);
		res.status(400).send(err.toString());
	}

});
const signatureCollector = async (proto) => {
	const tempFile = homeResolve(cache, 'proto');
	fs.writeFileSync(tempFile, proto);
	const formData = {
		proto: fs.createReadStream(tempFile)
	};
	const url = `http://localhost:${swarmServerPort}/channel/getSwarmSignatures`;
	const resp = await RequestPromise({url, formData});

	const {signatures} = resp;
	logger.debug('signatureCollector got', signatures.length);
	return {
		signatures: signUtil.fromBase64(signatures),
	};

};
router.post('/newOrderer', async (req, res) => {
	try {
		const {address} = req.body;
		logger.debug('/newOrderer', {address});

		const randomOrdererOrg = helper.randomOrg('orderer');
		const ordererClient = await helper.getOrgAdmin(randomOrdererOrg, 'orderer');
		const ordererChannel = helper.prepareChannel(undefined, ordererClient, true);

		const onUpdate = (original_config) => {
			const config = new ConfigFactory(original_config);
			config.addOrdererAddress(address);
			return config.build();
		};
		const orderer = ordererChannel.getOrderers()[0];
		await channelUpdate(ordererChannel, orderer, undefined, onUpdate, signatureCollector);
		res.json({newOrderer: address});
	} catch (err) {
		logger.error(err);
		res.status(400).send(err.toString());
	}
});
router.post('/getChannelConfig', async (req, res) => {

	const {nodeType} = req.body;
	const ramdomOrg = helper.randomOrg(nodeType);
	const client = await helper.getOrgAdmin(ramdomOrg, nodeType);
	let channel;
	let peer;
	if (nodeType === 'orderer') {
		channel = helper.prepareChannel(channelUtil.genesis, client, true);
	} else {
		channel = helper.prepareChannel(req.body.channelName, client, true);
		peer = channel.getPeers()[0];
	}
	logger.debug('/getChannelConfig', {nodeType, channelName: channel.getName()});
	const {original_config} = await getChannelConfigReadable(channel, peer);
	res.send(original_config);
});
router.post('/createOrUpdateOrg', multerCache.fields([{name: 'admins'}, {name: 'root_certs'}, {name: 'tls_root_certs'}])
	, async (req, res) => {
		logger.debug('[start]createOrUpdateOrg');
		try {
			const admins = req.files['admins'] ? req.files['admins'].map(({path}) => path) : [];
			const root_certs = req.files['root_certs'] ? req.files['root_certs'].map(({path}) => path) : [];
			const tls_root_certs = req.files['tls_root_certs'] ? req.files['tls_root_certs'].map(({path}) => path) : [];
			const {MSPID, MSPName, nodeType, skip} = req.body;

			let channel;
			let peer;
			let ordererOrg;
			if (nodeType === 'orderer') {
				ordererOrg = helper.randomOrg('orderer');
				const client = await helper.getOrgAdmin(ordererOrg, 'orderer');
				channel = helper.prepareChannel(channelUtil.genesis, client, true);

			} else {
				const channelName = req.body.channelName;
				const ramdomOrg = helper.randomChannelOrg(channelName);
				const client = await helper.getOrgAdmin(ramdomOrg, 'peer');
				channel = helper.prepareChannel(channelName, client, true);
				peer = channel.getPeers()[0];
			}
			const orderer = channel.getOrderers().filter(orderer => !ordererOrg || orderer.org === ordererOrg)[0]; //use same orderer


			// const peerEventHub = EventHubUtil.newEventHub(channel, peer);
			logger.debug('/createOrUpdateOrg', {channelName: channel.getName(), MSPID, MSPName, nodeType}, {
				admins,
				root_certs,
				tls_root_certs
			});


			const onUpdate = (original_config) => {
				//No update checking should be implemented in channel update
				const config = new ConfigFactory(original_config);
				return config.createOrUpdateOrg(MSPName, MSPID, nodeType, {
					admins,
					root_certs,
					tls_root_certs
				}, skip).build();
			};


			await channelUpdate(channel, orderer, peer, onUpdate, signatureCollector);
			if (peer) {
				const eventHub = EventHubUtil.newEventHub(channel, peer, true);
				const block = await EventHubUtil.BlockWaiter(eventHub);
				logger.info('new Block', block);
			} else {
				logger.info('orderer update will not trigger block event');
			}
			const {original_config} = await getChannelConfigReadable(channel, peer);
			res.send(original_config);
		} catch (err) {
			logger.error(err);
			res.status(400).send(err.toString());
		}

	});
module.exports = router;