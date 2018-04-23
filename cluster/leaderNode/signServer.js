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

	//TODO assuming we return two signatures: 1 from orderer 1 from peer
	const caCryptoConfig = globalConfig.docker.volumes.CACRYPTOROOT.dir;


	let signatures = [];
	let promise = Promise.resolve();
	if (globalConfig.orderer.type === 'kafka') {

		for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrg];
			const mspId = ordererOrgConfig.MSP.id;
			const cryptoPath = new CryptoPath(caCryptoConfig, {
				orderer: {org: ordererOrg},
				user: {name: 'admin'}
			});


			promise = promise.then(() => {
				const ordererClient = clientUtil.new();
				return userUtil.loadFromLocal(cryptoPath.ordererUserMSP(), ordererClient.getCryptoSuite(),
					{
						username: 'admin', domain: ordererOrg, mspId
					}).then(ordererAdmin => ordererClient.setUserContext(ordererAdmin, true))
					.then(() => {
						return signUtil.signs([Promise.resolve(ordererClient)], proto);
					});
			}).then(({signatures: ordererAdminSigns}) => {
				signatures = signatures.concat(ordererAdminSigns);
				return Promise.resolve();
			});

		}

	} else {
		//TODO
	}
	for (const peerOrg in globalConfig.orgs) {
		const peerOrgConfig = globalConfig.orgs[peerOrg];
		promise = promise.then(() =>{
			const peerOrgFull = `${peerOrg}.${globalConfig.domain}`;
			const peerClient = clientUtil.new();

			const cryptoPath = new CryptoPath(caCryptoConfig, {
				peer: {org: peerOrgFull},
				user: {name: 'admin'}
			});
			return userUtil.loadFromLocal(cryptoPath.peerUserMSP(), peerClient.getCryptoSuite(),
				{
					username: 'admin', domain: peerOrgFull,
					mspId: peerOrgConfig.MSP.id
				}).then(userAdmin => peerClient.setUserContext(userAdmin, true))
				.then(() => {
					return signUtil.signs([Promise.resolve(peerClient)], proto);
				});

		}).then(({signatures: peerAdminSigns}) => {
			signatures = signatures.concat(peerAdminSigns);
		}).then(() => {
			res.send({signatures});
		});
	}


});