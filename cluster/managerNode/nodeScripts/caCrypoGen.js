const config = require('./config');
const cryptoRoot = config.MSPROOT;
const ordererOrg = 'NewConsensus';
const ordererCAurl = `http://localhost:${config.orderer.orgs[ordererOrg].ca.portHost}`;
const ordererName = 'orderer0';
const ordererPort = config.orderer.orgs.NewConsensus.orderers.orderer0.portHost;
const ordererMSPID = config.orderer.orgs.NewConsensus.MSP.id;
const caCryptoGen = require('../../../config/ca-crypto-gen');
const pathUtil = require('../../../app/util/path');

const peerOrg = 'NEW'
const peerName = 'newContainer';
const cryptoPath = new pathUtil.CryptoPath(cryptoRoot, {
	orderer: {
		org: ordererOrg, name: ordererName
	},peer:{
		org:peerOrg,name:peerName
	}
});
const orderersDir = cryptoPath.orderers();

caCryptoGen.init(ordererCAurl, {mspId:ordererMSPID, domain:ordererOrg}, cryptoPath.ordererUsers()).then(()=>{
	return caCryptoGen.genOrderer(ordererCAurl, orderersDir,
		{ordererName, domain:ordererOrg, ordererPort, mspId:ordererMSPID},
		cryptoPath.ordererUsers());
});
const peerCAURL = `http://localhost:${config.orgs.NEW.ca.portHost}`;
const peersDir = cryptoPath.peers();
const peerMSPID = config.orgs.NEW.MSP.id;

caCryptoGen.init(peerCAURL,{mspId:peerMSPID,domain:peerOrg},cryptoPath.peerUsers()).then(()=>{
	return caCryptoGen.genPeer(peerCAURL,peersDir,
		{peerName,domain:peerOrg,mspId:peerMSPID},
		cryptoPath.peerUsers());
})



