const {port, cache} = require('./swarm.json').signServer;
const logger = require('../common/nodejs/logger').new('sign server');

const signUtil = require('../common/nodejs/multiSign');
const globalConfig = require('../config/orgs');
const fs = require('fs');
const {sha2_256} = require('../common/nodejs/helper');
const helper = require('../app/helper');
const {homeResolve, fsExtra} = require('../common/nodejs/path');
const Multer = require('multer');
const baseApp = require('../common/nodejs/express/baseApp');
exports.run = () => {
	const {app} =baseApp.run(port);
	const multerCache = Multer({dest: homeResolve(cache)});
	app.post('/', multerCache.single('proto'), async (req, res) => {
		const proto = fs.readFileSync(req.file.path);
		logger.info('sign request', 'hash', sha2_256(proto));


		let signatures = [];
		const clientPromises = [];
		if (globalConfig.orderer.type === 'kafka') {
			for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
				clientPromises.push(helper.getOrgAdmin(ordererOrg, 'orderer'));
			}
		} else {
			const ordererOrg = globalConfig.orderer.solo.orgName;
			clientPromises.push(helper.getOrgAdmin(ordererOrg, 'orderer'));

		}
		const {signatures: ordererAdminSigns} = await signUtil.signs(clientPromises, proto);
		signatures = signatures.concat(ordererAdminSigns);
		const peerClientPromises = [];

		for (const domain in globalConfig.orgs) {
			peerClientPromises.push(helper.getOrgAdmin(domain, 'peer'));
		}


		const {signatures: peerAdminSigns} = await signUtil.signs(peerClientPromises, proto);
		signatures = signatures.concat(peerAdminSigns);

		res.send({
			signatures: signUtil.toBase64(signatures)//TODO needed in http?
		});

	});
	return app;
};
exports.clean = () => {
	logger.info('clean');
	fsExtra.emptyDirSync(homeResolve(cache));
};
