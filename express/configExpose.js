const BaseApp = require('../common/nodejs/helper').nodeUtil.baseApp();
const router = BaseApp.getRouter();

router.get('/orgs', (req, res) => {
	const orgsJson = require('../config/orgs.json');
	res.json(orgsJson);
});
router.get('/chaincode', (req, res) => {
	const chaincodeJson = require('../config/chaincode.json');
	res.json(chaincodeJson);
});


module.exports = router;