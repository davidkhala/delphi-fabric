const express = require('express');
const router = express.Router();
const logger = require('../common/nodejs/logger').new('router signature');
const signUtil = require('../common/nodejs/multiSign');
const serverClient = require('../common/nodejs/express/serverClient');
const configtxlatorUtil = require('../common/nodejs/configtxlator');
const {nodeList} = require('../common/docker/nodejs/dockerode-util');
const {ConfigFactory} = configtxlatorUtil;
const helper = require('../app/helper');
const Multer = require('multer');
const fs = require('fs');
const {port: signServerPort} = require('./swarm.json').signServer;
const {cache, port: swarmServerPort} = require('./swarm.json').swarmServer;
const {homeResolve} = require('../common/nodejs/path');
const multerCache = Multer({dest: homeResolve(cache)});
const Request = require('request');

const channelUtil = require('../common/nodejs/channel');
const {sha2_256} = require('fabric-client/lib/hash');

router.post('/getSwarmSignatures', multerCache.single('proto'), async (req, res) => {
	try {
		if (!req.file) throw 'no attachment found';
		const protoPath = req.file.path;

		const proto = fs.readFileSync(protoPath);
		logger.debug('proto hash ', sha2_256(proto));

		const nodes = await nodeList(true);
		const ips = nodes.map(node => node.Status.Addr);

		logger.debug({ips});
		const promises = ips.map(async (ip) => {
			const resp = await serverClient.getSignatures(`http://${ip}:${signServerPort}`, protoPath);

			return JSON.parse(resp).signatures;
		});
		const resp = await Promise.all(promises);
		const joinedArray = resp.reduce((accumulator, currentValue) => accumulator.concat(currentValue));
		res.send({signatures: joinedArray});

	} catch (err) {
		logger.error(err);
		res.status(400).send(err.toString());
	}

});
const signatureCollector = async (proto) => {
	const tempFile = homeResolve(cache, 'proto');
	fs.writeFileSync(tempFile, proto);
	const body = await new Promise((resolve, reject) => {

		const formData = {
			proto: fs.createReadStream(tempFile)
		};
		Request.post({url: `http://localhost:${swarmServerPort}/channel/getSwarmSignatures`, formData}, (err, resp, body) => {
			if (err) reject(err);
			resolve(body);
		});
	});
	const {signatures} = JSON.parse(body);
	logger.debug('signatureCollector got',signatures.length);
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

		const randomPeerOrg = helper.randomOrg('peer');
		const peer = helper.newPeers([0], randomPeerOrg)[0];
		const peerClient = await helper.getOrgAdmin(randomPeerOrg, 'peer');

		const peerEventHub = helper.bindEventHub(peer, peerClient);

		await configtxlatorUtil.channelUpdate(ordererChannel, onUpdate, signatureCollector, peerEventHub,{nodeType:'orderer',peer});
		res.json({newOrderer: address});
	} catch (err) {
		logger.error(err);
		res.status(400).send(err.toString());
	}
});
router.post('/newOrg', multerCache.fields([{name: 'admins'}, {name: 'root_certs'}, {name: 'tls_root_certs'}])
	, async (req, res) => {
		try {
			const admins = req.files['admins']?req.files['admins'].map(({path}) => path):[];
			const root_certs = req.files['root_certs']?req.files['root_certs'].map(({path}) => path):[];
			const tls_root_certs = req.files['tls_root_certs']?req.files['tls_root_certs'].map(({path}) => path):[];
			const {MSPID, MSPName, nodeType} = req.body;

			let channelName;
			const randomPeerOrg = helper.randomOrg('peer');
			const peerClient = await helper.getOrgAdmin(randomPeerOrg, 'peer');
			const peer = helper.newPeers([0], randomPeerOrg)[0];
			const peerEventHub = helper.bindEventHub(peer, peerClient);
			if (nodeType === 'orderer') {
				channelName = channelUtil.genesis;
			} else {
				channelName = req.body.channelName;

			}
			const ramdomOrg = helper.randomOrg(nodeType);
			const client = await helper.getOrgAdmin(ramdomOrg,nodeType);
			const channel = helper.prepareChannel(channelName, client, true);


			logger.debug('/newOrg', {channelName, MSPID, MSPName, nodeType}, {admins, root_certs, tls_root_certs});


			const onUpdate = (original_config) => {
				//No update checking should be implemented in channel update
				const config = new ConfigFactory(original_config);
				return config.newOrg(MSPName, MSPID, nodeType, {admins, root_certs, tls_root_certs}).build();
			};


			await configtxlatorUtil.channelUpdate(channel, onUpdate, signatureCollector, peerEventHub,{nodeType,peer});
			const {original_config} = await configtxlatorUtil.getChannelConfigReadable(channel, nodeType);
			res.send(original_config);
		} catch (err) {
			logger.error(err);
			res.status(400).send(err.toString());
		}

	});
module.exports = router;