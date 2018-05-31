//work as network map server in Corda : see in readme

const logger = require('../common/nodejs/logger').new('swarm-server');
const swarmConfig = require('./swarm.json').swarmServer;
const {port, couchDB: {url}} = swarmConfig;
const app = require('../express/baseApp').run(port);
const {db = 'Couchdb'} = process.env;
logger.info('server start',{db});
class dbInterface {
	constructor({url, name}) {
		this.url = url;
		this.name = name;
	}

	async get(key) {
		throw 'to be implement';
	}

	async set(key, value) {
		return value;
	}

	async connect() {
		if (!this.connection) {
			this.connection = await this._connectBuilder();
		}
		return this.connection;
	}

	async _connectBuilder() {
		throw 'to be implement';
	}
}

const dbMap = {
	Couchdb: class extends dbInterface {
		async _connectBuilder() {
			const FabricCouchDB = require('fabric-client/lib/impl/CouchDBKeyValueStore');
			return await new FabricCouchDB({url: this.url, name: this.name});
		}

		async get(key) {
			const connection = await this.connect();
			return await connection.getValue(key);
		}

		async set(key, value) {
			const connection = await this.connect();
			return await connection.setValue(key, value);
		}
	},
	Redis: class extends dbInterface {
		constructor({url, name, port = '6379'}) {
			super({url, name});
			this.port = port;
		}

		async _connectBuilder() {
			const container = await this.run();
			const ioRedis = require('ioredis');
			const redis = new ioRedis(parseInt(this.port));
			return redis;
		}

		async get(key) {
			const connection = await this.connect();
			return await connection.get(key);
		}

		async set(key, value) {
			const connection = await this.connect();
			return await connection.set(key,value);
		}

		run() {
			const dockerUtil = require('../common/docker/nodejs/dockerode-util');
			const createOptions = {
				name: this.name,
				Image: 'redis:latest',
				ExposedPorts: {
					'6379': {},
				},
				Hostconfig: {
					PortBindings: {
						'6379': [
							{
								HostPort: this.port
							}
						]
					},
				},
			};
			return dockerUtil.containerStart(createOptions);
		}
	}
};

const swarmDoc = 'swarm';
const leaderKey = 'leaderNode';
const managerKey = 'managerNodes';


app.use('/config', require('../express/configExpose'));

//FIXME async will not prompt error!!!
app.get('/leader', async (req, res) => {
	logger.debug('leader info');
	const connection = await new dbMap[db]({url, name: swarmDoc});
	const value = await connection.get(leaderKey);
	res.json(value);
});
app.post('/leader/update', async (req, res) => {
	const {ip, hostname, managerToken} = req.body;
	logger.debug('leader update', {ip, hostname, managerToken});
	const connection = await new dbMap[db]({url, name: swarmDoc});
	const value = await connection.set(leaderKey, {ip, hostname, managerToken});
	res.json(value);
});

app.get('/manager', async (req, res) => {
	logger.debug('manager list');
	const connection = await new dbMap[db]({url, name: swarmDoc});
	const value = await connection.get(managerKey);
	res.json(value);

});
/**
 * TODO: how to identify a node? ip /hostname or id?
 */
app.post('/manager/join', async (req, res) => {
	const {ip, hostname} = req.body;
	logger.debug('manager join', {ip, hostname});

	const connection = await new dbMap[db]({url, name: swarmDoc});
	const leaderValue = await connection.get(leaderKey);
	if (leaderValue) {
		if (leaderValue.ip === ip) {
			res.send(`request.ip ${ip} conflict with ${leaderKey}.ip`);
			return;
		}
		if (leaderValue.hostname === hostname) {
			res.send(`request.hostname ${hostname} conflict with ${leaderKey}.hostname`);
			return;
		}
	}

	const value = await connection.get(managerKey);
	let newValue;
	if (value) {
		newValue = value;
		if (newValue[ip]) {
			newValue[ip].hostname = hostname;
		} else {
			newValue[ip] = {hostname};
		}

	} else {
		newValue = {[ip]: {hostname}};
	}
	await connection.set(managerKey, newValue);
	res.json({ip, hostname});

});
app.post('/manager/leave', async (req, res) => {
	const {ip} = req.body;
	logger.debug('manager leave', {ip});
	const connection = await new dbMap[db]({url, name: swarmDoc});

	const value = await connection.get(managerKey);
	let newValue;
	if (value) {
		newValue = value;
		if (newValue[ip]) {
			delete newValue[ip];
		}
	} else {
		newValue = {};
	}
	await connection.set(managerKey, newValue);
	res.json({ip});
});

app.use('/channel', require('./signaturesRouter'));
app.get('/block', async (req, res) => {
	const globalConfig = require('../config/orgs');
	const path = require('path');
	const blockFile = path.resolve(globalConfig.docker.volumes.CONFIGTX.dir, globalConfig.orderer.genesis_block.file);
	res.sendFile(blockFile);
});
app.get('/', (req, res) => {
	res.json({
		errCode: 'success',
		errMessage: 'pong'
	});
});