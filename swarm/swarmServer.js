//work as network map server in Corda : see in readme

const logger = require('../common/nodejs/logger').new('swarm-server');
const swarmConfig = require('./swarm.json').swarmServer;
const {port, cache} = swarmConfig;

const {db = 'Redis'} = process.env;
const {container_name, port: dbPort} = swarmConfig[db];
const path = require('path');

const {fsExtra} = require('../common/nodejs/path');
const {sha2_256} = require('../common/nodejs/helper');
const {projectResolve} = require('../app/helper');

const dockerUtil = require('../common/docker/nodejs/dockerode-util');

const dbInterface = require('khala-nodeutils/kvDB').DBInterface;

const dbMap = {
	Couchdb: class extends dbInterface {
		constructor({url = `http://localhost:${port}`, name, port = '5984', table = name}) {
			super({url, name, port});
			this.table = table;
		}

		async _connectBuilder() {
			const FabricCouchDB = require('fabric-client/lib/impl/CouchDBKeyValueStore');
			return await new FabricCouchDB({url: this.url, name: this.table});
		}

		async get(key) {
			const connection = await this.connect();
			return await connection.getValue(key);
		}

		async set(key, value) {
			const connection = await this.connect();
			return await connection.setValue(key, value);
		}

		run() {

			const createOptions = {
				name: this.name,
				Image: 'hyperledger/fabric-couchdb:latest',
				ExposedPorts: {
					'5984': {},
				},
				Hostconfig: {
					PortBindings: {
						'5984': [
							{
								HostPort: this.port
							}
						]
					},
				},
			};
			return dockerUtil.containerStart(createOptions);
		}

		async clear() {
			return dockerUtil.containerDelete(this.name);
		}
	},
	Redis: class extends dbInterface {
		constructor({url, name, port = '6379'}) {
			super({url, name, port});
		}

		async _connectBuilder() {
			const ioRedis = require('ioredis');
			const redis = new ioRedis(parseInt(this.port));
			return redis;
		}

		async get(key) {
			const connection = await this.connect();
			const value = await connection.get(key);
			return JSON.parse(value);
		}

		async set(key, value) {
			const connection = await this.connect();
			return await connection.set(key, JSON.stringify(value));
		}

		async clear() {
			return dockerUtil.containerDelete(this.name);
		}

		run() {

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

exports.run = () => {
	logger.info('server start', {db, port});
	const {app} = require('khala-nodeutils/baseApp').run(port);
	app.use('/config', require('../express/configExpose'));

	app.get('/leader', async (req, res) => {
		const connection = new dbMap[db]({name: container_name, table: swarmDoc});
		const value = await connection.get(leaderKey);
		logger.debug('leader info', value);
		res.json(value);
	});
	app.post('/leader/update', async (req, res) => {
		const {ip, hostname, managerToken, workerToken} = req.body;
		logger.debug('leader update', {ip, hostname, managerToken, workerToken});
		const connection = new dbMap[db]({name: container_name, table: swarmDoc});
		const value = await connection.set(leaderKey, {ip, hostname, managerToken, workerToken});
		res.json(value);
	});

	app.use('/channel', require('./signaturesRouter'));
	app.get('/block', async (req, res) => {
		const globalConfig = require('../config/orgs');
		const dir = projectResolve(globalConfig.docker.volumes.CONFIGTX.dir);
		const blockFile = path.resolve(dir, globalConfig.orderer.genesis_block.file);
		const buffer = fsExtra.readFileSync(blockFile, 'binary');
		logger.info('GET block', 'check buffer hash', sha2_256(buffer));
		res.send(buffer);
	});
	app.get('/', async (req, res) => {
		try {
			//touch
			new dbMap[db]({name: container_name, table: swarmDoc});
			res.json({
				errCode: 'success',
				message: 'pong'
			});
		} catch (err) {
			logger.error(err);
			res.status(400).send(err.toString());
		}

	});
	//TODO app.post('/docker/genOrderer'
	//TODO app.post('/docker/genPeer'
	return app;
};
exports.clean = async () => {
	logger.info('clean');
	fsExtra.emptyDirSync(path.resolve(cache));
	const connection = new dbMap[db]({name: container_name});
	await connection.clear();
};
