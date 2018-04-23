const express = require('express');
const router = express.Router();
const logger = require('../app/util/logger').new('router signature');
const Multer = require('multer');
const fs = require('fs');
const singerServerConfig=require('./swarm.json').signServer;
const signServerPort= singerServerConfig.port;
const cache = Multer({dest: singerServerConfig.cache});

const swarmConfig = require('./swarm.json').swarmServer;
const {couchDB: {url}} = swarmConfig;
const swarmDoc = 'swarm';
const leaderKey = 'leaderNode';
const managerKey = 'managerNodes';
const Request = require('request');

const FabricCouchDB = require('fabric-client/lib/impl/CouchDBKeyValueStore');
router.post('/getSignatures',cache.single('proto'), async (req, res) => {
	const proto = req.file;

	logger.debug(proto);

	const connection = await new FabricCouchDB({url, name: swarmDoc});

	let ips = [];
	const leaderValue = await connection.getValue(leaderKey);
	if(leaderValue){
		const {ip} = leaderValue;
		ips.push(ip);
	}else {
		res.send('No leader found');
	}
	const managers = await connection.getValue(managerKey);
	if (managers) {
		ips = ips.concat(Object.keys(managers));
	} else {
		logger.warn('No managers found');
	}
	logger.debug({ips});
	const promises = ips.map((ip)=>{
		return new Promise((resolve,reject)=>{
			const formData = {
				 proto:fs.createReadStream(proto.path)
			};
			Request.post({url: `http://${ip}:${signServerPort}`, formData}, (err, resp, body)=>{
				if(body){
					const {signatures} = body;
					logger.debug({signatures}, 'from',ip);
					resolve({signatures});
				}else {
					reject(`no response from ${ip}:${signServerPort}`);
				}
			});
		});

	});
	Promise.all(promises).then(resp=>{
		res.send(resp);
	}).catch(err=>{
		res.send(err);
	});


});
module.exports = router;