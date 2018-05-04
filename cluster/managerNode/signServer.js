const config = require('./nodeScripts/config');
const signServerPort = config.signServer.port;
const logger = require('../../common/nodejs/logger').new('sign server');
const app = require('../../express/baseApp').run(signServerPort);
const Multer = require('multer');
const cache = Multer({dest: config.signServer.cache});
const userUtil = require('../../common/nodejs/user');
const signUtil = require('../../common/nodejs/multiSign');
const clientUtil = require('../../common/nodejs/client');
const pathUtil = require('../../common/nodejs/path');
const {CryptoPath} = pathUtil;


app.post('/', cache.single('proto'), async (req, res) => {
	logger.info('sign request');
	const proto = req.file;

	//TODO assuming we return two signatures: 1 from orderer 1 from peer
	const caCryptoConfig = config.MSPROOT;
	const ordererClient = clientUtil.new();

	const cryptoPath = new CryptoPath(caCryptoConfig, {
		orderer: {name: 'orderer0', org: 'NewConsensus',},
		peer: {name: 'newContainer', org: 'NEW'},
		user: {name: 'Admin'}
	});
	// (userMSPRoot, cryptoSuite, {username, domain, mspId});
	let signatures = [];
	return userUtil.loadFromLocal(cryptoPath.ordererUserMSP(), ordererClient.getCryptoSuite(),
		{
			username: 'Admin', domain: 'NewConsensus',
			mspId: config.orderer.orgs.NewConsensus.MSP.id
		}).then(ordererAdmin => ordererClient.setUserContext(ordererAdmin,true))
		.then(() => {
			return signUtil.signs([Promise.resolve(ordererClient)], proto);
		}).then(({signatures: ordererAdminSigns}) => {
			signatures = signatures.concat(ordererAdminSigns);
		}).then(() => {
			const peerClient = clientUtil.new();

			return userUtil.loadFromLocal(cryptoPath.peerUserMSP(),peerClient.getCryptoSuite(),
				{
					username:'Admin', domain:'NEW',
					mspId:config.orgs.NEW.MSP.id
				}).then(userAdmin =>peerClient.setUserContext(userAdmin,true))
				.then(()=>{
					return signUtil.signs([Promise.resolve(peerClient)],proto);
				}).then(({signatures: peerAdminSigns})=>{
					signatures = signatures.concat(peerAdminSigns);
				});

		}).then(()=>{
			res.send({signatures});
		});


});