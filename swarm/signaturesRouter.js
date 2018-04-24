const express = require('express');
const router = express.Router();
const logger = require('../app/util/logger').new('router signature');
const Multer = require('multer');
const fs = require('fs');
const path =require('path')
const singerServerConfig = require('./swarm.json').signServer;
const signServerPort = singerServerConfig.port;
const cache = Multer({dest: singerServerConfig.cache});

const swarmConfig = require('./swarm.json').swarmServer;
const {couchDB: {url}} = swarmConfig;
const swarmDoc = 'swarm';
const leaderKey = 'leaderNode';
const managerKey = 'managerNodes';
const Request = require('request');

const FabricCouchDB = require('fabric-client/lib/impl/CouchDBKeyValueStore');
router.post('/getSignatures', cache.single('proto'), async (req, res) => {
	const proto = req.file;

	logger.debug(proto);

	const connection = await new FabricCouchDB({url, name: swarmDoc});

	let ips = [];
	const leaderValue = await connection.getValue(leaderKey);
	if (leaderValue) {
		const {ip} = leaderValue;
		ips.push(ip);
	} else {
		res.send('No leader found');
	}
	const managers = await connection.getValue(managerKey);
	if (managers) {
		ips = ips.concat(Object.keys(managers));
	} else {
		logger.warn('No managers found');
	}
	logger.debug({ips});
	const promises = ips.map((ip) => {
		return new Promise((resolve, reject) => {
			const formData = {
				proto: fs.createReadStream(proto.path)
			};
			Request.post({url: `http://${ip}:${signServerPort}`, formData}, (err, resp, body) => {
				if (body) {
					const {signatures} = body;
					logger.debug({signatures}, 'from', ip);
					resolve({signatures});
				} else {
					reject(`no response from ${ip}:${signServerPort}`);
				}
			});
		});

	});
	Promise.all(promises).then(resp => {
		res.send(resp);
	}).catch(err => {
		res.send(err);
	});

});
router.post('/newOrg', cache.fields([{name: 'admins'}, {name: 'root_certs'}, {name: 'tls_root_certs'}])
	, (req, res) => {
		const adminCerts = req.files['admins'];
		const rootCerts = req.files['root_certs'];
		const tlsRootCerts = req.files['tls_root_certs'];
		logger.debug({adminCerts, rootCerts, tlsRootCerts});
		const {channelName, MSPID, MSPName, orderer, peer} = req.body;
		const configtxlatorUtil = require('../app/configtxlator');
		const ClientUtil = require('../app/util/client');
		const helper = require('../app/helper');

		return helper.getOrgAdmin('TK.Teeking.com').then((client) => {
			const channel = helper.prepareChannel(channelName, client, true);

			const onUpdate = (original_config) => {
				logger.debug('channel.getOrganizations() before', channel.getOrganizations());
				if (channel.getOrganizations().find((entry) => {
					return entry.id === MSPID;
				})) {
					logger.warn(MSPID, 'msp exist in channel', channel.getName());
					return original_config;
				} else {

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
				const signServerConfig = require('../swarm/swarm.json').signServer;
				const signServerPort = signServerConfig.port;
				const signCache = signServerConfig.cache;
				const tempFile =path.resolve(signCache,'proto');
				fs.writeFileSync(tempFile, proto);
				return new Promise((resolve, reject) => {

					const formData = {
						proto: fs.createReadStream(tempFile)
					};
					Request.post({url: `http://localhost:${signServerPort}`, formData}, (err, resp, body) => {
						logger.debug(err, resp, body);
					});
				});

			};


			return configtxlatorUtil.channelUpdate(channel, onUpdate, signatureCollector, peerEventHub).then(() => {
				return channel.initialize().then((_) => {
					logger.debug('channel.getOrganizations() after', channel.getOrganizations());
					return Promise.resolve(_);
				});
			});
		});

	});
module.exports = router;