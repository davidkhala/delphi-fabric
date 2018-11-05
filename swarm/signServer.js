const {port, cache} = require('./swarm.json').signServer;
const logger = require('../common/nodejs/logger').new('sign server');

const signUtil = require('../common/nodejs/multiSign');
const globalConfig = require('../config/orgs');
const {sha2_256} = require('../common/nodejs/helper');
const helper = require('../app/helper');
const {projectResolve} = helper;
const {fsExtra} = require('../common/nodejs/path');
const Multer = require('multer');
const baseApp = require('khala-nodeutils/baseApp');
const cacheDir = projectResolve(cache);
exports.run = () => {
	const {app} = baseApp.run(port);
	const multerCache = Multer({dest: cacheDir});
	app.post('/', multerCache.single('proto'), async (req, res) => {
		const proto = fsExtra.readFileSync(req.file.path);
		logger.info('sign request', 'hash', sha2_256(proto));


		let signatures = [];
		const ordererClients = [];
		if (globalConfig.orderer.type === 'kafka') {
			for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
				const client = await helper.getOrgAdmin(ordererOrg, 'orderer');
				ordererClients.push(client);
			}
		} else {
			const ordererOrg = globalConfig.orderer.solo.orgName;
			const client = await helper.getOrgAdmin(ordererOrg, 'orderer');
			ordererClients.push(client);
		}
		const {signatures: ordererAdminSigns} = signUtil.signs(ordererClients, proto);
		signatures = signatures.concat(ordererAdminSigns);
		const peerClients = [];

		for (const domain in globalConfig.orgs) {
			const peerClient = await helper.getOrgAdmin(domain, 'peer');
			peerClients.push(peerClient);
		}


		const {signatures: peerAdminSigns} = signUtil.signs(peerClients, proto);
		signatures = signatures.concat(peerAdminSigns);

		res.send({
			signatures: signUtil.toBase64(signatures)//TODO needed in http?
		});

	});
	return app;
};
exports.clean = () => {
	logger.info('clean');
	fsExtra.emptyDirSync(cacheDir);
};
