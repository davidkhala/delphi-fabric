const config = require('../config');
const path = require('path');
const cryptoRoot = config.MSPROOT;
const ordererOrg = 'NewConsensus';
const ordererCAurl = `http://localhost:${config.orderer.orgs[ordererOrg].ca.portHost}`;
const ordererName = 'orderer0';
const ordererPort = config.orderer.orgs.NewConsensus.orderers.orderer0.portHost;
const mspId = config.orderer.orgs.NewConsensus.MSP.id;
const caCryptoGen = require('../../../config/ca-crypto-gen');
const pathUtil = require('../../../app/util/path');

const cryptoPath = new pathUtil.CryptoPath(cryptoRoot, {
	orderer: {
		org: ordererOrg, name: ordererName
	}
});
const orderersDir = cryptoPath.orderers();
const usersDir = cryptoPath.ordererUsers();
const domain = ordererOrg;
caCryptoGen.init(ordererCAurl, {mspId, domain}, usersDir).then(()=>{
	return caCryptoGen.genOrderer(ordererCAurl, orderersDir,
		{ordererName, domain, ordererPort, mspId},
		usersDir);
});


// exports.genOrderer = (url, orderersDir, {ordererName, domain, ordererPort, mspId, affiliationRoot = domain}, usersDir) => {