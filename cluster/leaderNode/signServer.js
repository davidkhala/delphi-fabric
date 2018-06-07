const {port, cache} = require('../../swarm/swarm.json').signServer;
const logger = require('../../common/nodejs/logger').new('sign server');

const signUtil = require('../../common/nodejs/multiSign');
const globalConfig = require('../../config/orgs');
const fs = require('fs');
const fsExtra = require('fs-extra');
const {sha2_256} = require('fabric-client/lib/hash');
const helper = require('../../app/helper');
const {homeResolve} = require('../../common/nodejs/path');
exports.run = () => {
	const {app} = require('../../common/nodejs/baseApp').run(port);
	const Multer = require('multer');
	const multerCache = Multer({dest: homeResolve(cache)});
	app.post('/', multerCache.single('proto'), async (req, res) => {
		const proto = fs.readFileSync(req.file.path);
		logger.info('sign request', 'hash', sha2_256(proto));


		let signatures = [];
		const clientPromises = [];
		if (globalConfig.orderer.type === 'kafka') {
			for (const ordererOrg in globalConfig.orderer.kafka.orgs) {
				clientPromises.push(helper.getOrgAdmin(ordererOrg));
			}
		} else {
			const ordererOrg = globalConfig.orderer.solo.orgName;
			clientPromises.push(helper.getOrgAdmin(ordererOrg));

		}
		const {signatures: ordererAdminSigns} = await signUtil.signs(clientPromises, proto);
		signatures = signatures.concat(ordererAdminSigns);
		const peerClientPromises = [];

		for (const domain in globalConfig.orgs) {
			peerClientPromises.push(helper.getOrgAdmin(domain));
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
	fsExtra.removeSync(homeResolve(cache));
};
