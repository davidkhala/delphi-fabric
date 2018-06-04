const express = require('express');
const router = express.Router();
const logger = require('../common/nodejs/logger').new('router signature');
const signUtil = require('../common/nodejs/multiSign');
const serverClient = require('../common/nodejs/express/serverClient');
const Multer = require('multer');
const fs = require('fs');
const path = require('path');
const {port: signServerPort} = require('./swarm.json').signServer;
const {cache, port: swarmServerPort} = require('./swarm.json').swarmServer;

const multerCache = Multer({dest: cache});
const Request = require('request');

const {sha2_256} = require('fabric-client/lib/hash');

router.post('/getSignatures', multerCache.single('proto'), async (req, res) => {
	try {
		if (!req.file) throw 'no attachment found';
		const protoPath = req.file.path;

		const proto = fs.readFileSync(protoPath);
		logger.debug('proto hash ', sha2_256(proto));
		let ips = [];
		const swarmServerUrl = `http://localhost:${swarmServerPort}`;
		const leaderInfo = JSON.parse(await serverClient.leader.info(swarmServerUrl));
		if (!leaderInfo || !leaderInfo.ip) throw 'no leader found';
		logger.debug({leaderInfo});
		ips.push(leaderInfo.ip);
		const managers = JSON.parse(await serverClient.manager.info(swarmServerUrl));

		if (managers) {
			ips = ips.concat(Object.keys(managers));
		} else {
			logger.warn('No managers found');
		}
		logger.debug({ips});
		const promises = ips.map(async (ip) => {
			const resp = await serverClient.getSignatures(`http://${ip}:${signServerPort}`, protoPath);

			return JSON.parse(resp).signatures;
		});
		const resp = await Promise.all(promises);
		const joinedArray = resp.reduce((accumulator, currentValue) => accumulator.concat(currentValue));
		res.send(joinedArray);

	} catch (err) {
		logger.error(err);
		res.status(400).send(err.toString());
	}

});
router.post('/newOrg', multerCache.fields([{name: 'admins'}, {name: 'root_certs'}, {name: 'tls_root_certs'}])
	, async (req, res) => {
		try {
			const adminCerts = req.files['admins'];
			const rootCerts = req.files['root_certs'];
			const tlsRootCerts = req.files['tls_root_certs'];
			logger.debug({adminCerts, rootCerts, tlsRootCerts});
			const {channelName, MSPID, MSPName, nodeType} = req.body;
			const configtxlatorUtil = require('../common/nodejs/configtxlator');
			const helper = require('../app/helper');

			const client = await helper.getOrgAdmin('TK.Teeking.com');
			const channel = helper.prepareChannel(channelName, client, true);

			const onUpdate = (original_config) => {
				logger.debug('channel.getOrganizations() before', channel.getOrganizations());
				if (channel.getOrganizations().find((entry) => {
					return entry.id === MSPID;
				})) {
					logger.warn(MSPID, 'msp exist in channel', channel.getName());
					return original_config;
				} else {

					//FIXME configtxlatorUtil
					return configtxlatorUtil.newPeerOrg(original_config, MSPName, MSPID,
						{
							admins: adminCerts ? adminCerts.map(({path}) => path) : [],
							root_certs: rootCerts ? rootCerts.map(({path}) => path) : [],
							tls_root_certs: tlsRootCerts ? tlsRootCerts.map(({path}) => path) : []
						});
				}
			};

			const peer = helper.newPeers([0], 'TK.Teeking.com')[0];
			const peerEventHub = helper.bindEventHub(peer, client);
			const signatureCollector = (proto) => {
				const tempFile = path.resolve(signCache, 'proto');
				fs.writeFileSync(tempFile, proto);
				return new Promise((resolve, reject) => {

					const formData = {
						proto: fs.createReadStream(tempFile)
					};
					Request.post({url: `http://localhost:${signServerPort}`, formData}, (err, resp, body) => {
						if (err) reject(err);
						const {signatures, proto} = JSON.parse(body);
						logger.debug(signatures);
						resolve({
							signatures: signUtil.fromBase64(signatures),
							proto: new Buffer(proto, 'binary')
						});
					});
				});

			};


			await configtxlatorUtil.channelUpdate(channel, onUpdate, signatureCollector, peerEventHub);
			await channel.initialize();
			logger.debug('channel.getOrganizations() after', channel.getOrganizations());
			res.json(channel.getOrganizations());
		} catch (err) {
			res.send(err);
		}

	});
module.exports = router;