const singerServerConfig = require('../../swarm/swarm.json').signServer;
const signServerPort = singerServerConfig.port;
const logger = require('../../common/nodejs/logger').new('sign server');
const app = require('../../express/baseApp').run(signServerPort);
const Multer = require('multer');
const cache = Multer({dest: singerServerConfig.cache});

const userUtil = require('../../common/nodejs/user');
const signUtil = require('../../common/nodejs/multiSign');
const clientUtil = require('../../common/nodejs/client');
const pathUtil = require('../../common/nodejs/path');
const {CryptoPath} = pathUtil;
const fs = require('fs');

app.post('/', cache.single('proto'), async (req, res) => {

	const proto = fs.readFileSync(req.file.path);
	logger.info('sign request',{proto});
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
				user: {name: 'Admin'}
			});

			const ordererClient = clientUtil.new();

			clientPromises.push(userUtil.loadFromLocal(cryptoPath.ordererUserMSP(), ordererClient.getCryptoSuite(),
				{
					username: 'Admin', domain: ordererOrg, mspId
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
			user: {name: 'Admin'}
		});

		const ordererClient = clientUtil.new();

		clientPromises.push(userUtil.loadFromLocal(cryptoPath.ordererUserMSP(), ordererClient.getCryptoSuite(),
			{
				username: 'Admin', domain: ordererOrg, mspId
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
			user: {name: 'Admin'}
		});
		peerClientPromises.push(
			userUtil.loadFromLocal(cryptoPath.peerUserMSP(), peerClient.getCryptoSuite(),
				{
					username: 'Admin', domain,
					mspId: peerOrgConfig.MSP.id
				}).then(userAdmin => peerClient.setUserContext(userAdmin, true))
				.then(() => peerClient));


	}

	return promise.then(() => {
		return signUtil.signs(peerClientPromises, proto);
	}).then(({signatures: peerAdminSigns}) => {
		signatures = signatures.concat(peerAdminSigns);

		res.send({signatures:signUtil.toBase64(signatures)
			,proto
		});
	});

});