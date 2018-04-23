const express = require('express');
const router = express.Router();
const logger = require('../app/util/logger').new('router signature');
const Multer = require('multer');
const cache = Multer({dest: 'cache/'});
const fs = require('fs');
const signServerPort= require('./swarm.json').signServer.port;
const swarmConfig = require('./swarm.json').swarmServer;
const {couchDB: {url}} = swarmConfig;
const swarmDoc = 'swarm';
const leaderKey = 'leaderNode';
const managerKey = 'managerNodes';
const Request = require('request');

const FabricCouchDB = require('fabric-client/lib/impl/CouchDBKeyValueStore');

router.post('/getSignatures',cache.single('proto'), async (req, res) => {
	const proto = req.file;

	console.log(proto);
	// const connection = await new FabricCouchDB({url, name: swarmDoc});
    //
	// let ips = [];
	// const leaderValue = await connection.getValue(leaderKey);
	// if(leaderValue){
	// 	const {ip} = leaderValue;
	// 	ips.push(ip);
	// }else {
	// 	res.send('No leader found');
	// }
	// const managers = await connection.getValue(managerKey);
	// if (managers) {
	// 	ips = ips.concat(Object.keys(managers));
	// } else {
	// 	logger.warn('No managers found');
	// }
	// logger.debug({ips});
	// const promises = ips.map((ip)=>{
	// 	return new Promise((resolve,reject)=>{
	// 		//FIXME is size over post limits
	// 		const formData = {
	// 			// proto
	// 		};
	// 		Request.post({url: `http://${ip}:${signServerPort}`, formData}, (err, resp, body)=>{
	// 			if(err) reject(err);
	// 			const {signatures} = body;
	// 			logger.debug({signatures}, 'from',ip);
	// 			resolve({signatures});
	// 		});
	// 	});
    //
	// });


});