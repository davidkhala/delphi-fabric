const singerServerConfig = require('../../swarm/swarm.json').signServer;
const signServerPort = singerServerConfig.port;
const logger = require('../../app/util/logger').new('sign server');
const app = require('../../express/baseApp').run(signServerPort);
const Multer = require('multer');
const cache = Multer({dest: singerServerConfig.cache});

const userUtil = require('../../app/util/user');
const signUtil = require('../../app/util/multiSign');
const clientUtil = require('../../app/util/client');
const pathUtil = require('../../app/util/path');
const {CryptoPath} = pathUtil;


app.post('/', cache.single('proto'), async (req, res) => {
	logger.info('sign request');
	const proto = req.file;
	const globalConfig = require('../../config/orgs');

	const caCryptoConfig = globalConfig.docker.volumes.CACRYPTOROOT.dir;


	let signatures = [];
	let promise = Promise.resolve();
	if (globalConfig.orderer.type === 'kafka') {

		const clientPromises = [];
		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const mspId = ordererOrgConfig.MSP.id;
			const cryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {org: ordererOrg},
				user: {name: 'admin'}
			});

			const ordererClient = clientUtil.new();

			clientPromises.push(userUtil.loadFromLocal(cryptoPath.ordererUserMSP(), ordererClient.getCryptoSuite(),
				{
					username: 'admin', domain: ordererOrg, mspId
				}).then(ordererAdmin => ordererClient.setUserContext(ordererAdmin, true))
				.then(() => ordererClient));

		}

		promise = promise.then(() => {
			return signUtil.signs(clientPromises, proto);
		}).then(({signatures: ordererAdminSigns}) => {
			signatures = signatures.concat(ordererAdminSigns);
			return Promise.resolve();
		});

	} else {
		const clientPromises = [];
		const ordererOrg = globalConfig.orderer.solo.orgName;
		const ordererOrgConfig = globalConfig.orderer.solo;
		const mspId = ordererOrgConfig.MSP.id;
		const cryptoPath = new CryptoPath(caCryptoConfig, {
			orderer: {org: ordererOrg},
			user: {name: 'admin'}
		});

		const ordererClient = clientUtil.new();

		clientPromises.push(userUtil.loadFromLocal(cryptoPath.ordererUserMSP(), ordererClient.getCryptoSuite(),
			{
				username: 'admin', domain: ordererOrg, mspId
			}).then(ordererAdmin => ordererClient.setUserContext(ordererAdmin, true))
			.then(() => ordererClient));

		promise = promise.then(() => {
			return signUtil.signs(clientPromises, proto);
		}).then(({signatures: ordererAdminSigns}) => {
			signatures = signatures.concat(ordererAdminSigns);
			return Promise.resolve();
		});


	}
	const peerClientPromises = [];

	for (const domain in globalConfig.orgs) {
		const peerOrgConfig = globalConfig.orgs[domain];
		const peerClient = clientUtil.new();

		const cryptoPath = new CryptoPath(caCryptoConfig, {
			peer: {org: domain},
			user: {name: 'admin'}
		});
		peerClientPromises.push(
			userUtil.loadFromLocal(cryptoPath.peerUserMSP(), peerClient.getCryptoSuite(),
				{
					username: 'admin', domain,
					mspId: peerOrgConfig.MSP.id
				}).then(userAdmin => peerClient.setUserContext(userAdmin, true))
				.then(() => peerClient));


	}

	return promise.then(() => {
		return signUtil.signs(peerClientPromises, proto);
	}).then(({signatures: peerAdminSigns}) => {
		signatures = signatures.concat(peerAdminSigns);
		res.send({signatures});
	});

});