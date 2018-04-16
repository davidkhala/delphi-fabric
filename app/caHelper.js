const helper = require('./helper');

const logger = require('./util/logger').new('caHelper');
const globalConfig = require('../config/orgs.json');
const caUtil = require('./util/ca');
const userUtil = require('./util/user');
const peerUtil = require('./util/peer');
const ordererUtil = require('./util/orderer');
const fs = require('fs-extra');
const path = require('path');
const caMSPROOT = globalConfig.docker.volumes.CACRYPTOROOT.dir;
const {domain} = globalConfig;
const affiliationRoot= 'TK';

const orderersDir = path.resolve(caMSPROOT, 'ordererOrganizations', domain, 'orderers');
fs.ensureDirSync(orderersDir);
const ordererUsersDir = path.resolve(caMSPROOT, 'ordererOrganizations', domain, 'users');
fs.ensureDirSync(ordererUsersDir);
fs.ensureDirSync(path.resolve(caMSPROOT, 'peerOrganizations'));


exports.getOrdererAdmin = ({ordererName}, caService = getOrdererCaService({ordererName})) => {

	const MSPID = globalConfig.orderer.MSP.id;

	const enrollmentID = 'admin';
	const ordererUserFull = userUtil.formatUsername(enrollmentID,domain);
	const userMSPRoot = path.resolve(ordererUsersDir,ordererUserFull,'msp');

	return userUtil.loadFromLocal(userMSPRoot, undefined, {username:enrollmentID, domain,mspId:MSPID}).then((user)=>{
		if(user){
			logger.info('orderer admin found in local');
			return Promise.resolve(user);
		}
		return caService.enroll({enrollmentID, enrollmentSecret: 'passwd'}).then((result) => {
			caUtil.user.toMSP(result,userMSPRoot,{username:enrollmentID,domain});
			return userUtil.build(ordererUserFull, result, MSPID);
		});
	});

};

//TODO
exports.enrollOrderer = ({ordererName,ordererPort},caService = getOrdererCaService({ordererName}))=>{

	const orderer_hostName_full = peerUtil.formatPeerName(ordererName,domain);
	const ordererMSPRoot = path.resolve(orderersDir,orderer_hostName_full,'msp');


	const orderer =ordererUtil.loadFromLocal(ordererMSPRoot,{orderer_hostName_full,ordererPort});
	if(orderer)return orderer;
	return module.exports.getOrdererAdmin({ordererName},caService)
		.then(ordererAdmin=>{
			const certificate = userUtil.getCertificate(ordererAdmin);
			caUtil.peer.toadmincerts({certificate},ordererMSPRoot,{username:'admin',domain});
			return caUtil.register(caService,{
				enrollmentID:ordererName,
				enrollmentSecret:'passwd',
				role:'orderer',
				affiliation:`${affiliationRoot}.orderer`
			},ordererAdmin);
		})
		.then(()=>{
			return caService.enroll({enrollmentID:ordererName,enrollmentSecret:'passwd'});
		})
		.then(result=>{
			caUtil.peer.toMSP(result,ordererMSPRoot,{peerName:ordererName,domain});
			return Promise.resolve();
		});

};
const setCAAdminUser = ({orgName}, caService = getCaService({orgName})) => {
	const companyConfig = globalConfig;
	const orgsConfig = companyConfig.orgs;

	const MSPID = orgsConfig[orgName].MSP.id;
	return caService.enroll({enrollmentID: 'admin', enrollmentSecret: 'passwd'}).then((result) => {
		return userUtil.build(helper.formatUsername('admin', orgName), result, MSPID);
	});
};

const getOrdererCaService = ({ordererName}) => {
	const {TLS} = globalConfig;
	let ordererConfig;
	if (globalConfig.orderer.type === 'kafka') {
		if(!ordererName) throw new Error('missing ordererName in kafka mode');
		ordererConfig = globalConfig.orderer.kafka.orderers[ordererName];
	} else {
		ordererConfig = globalConfig.orderer.solo;
	}
	const ca_port = TLS ? ordererConfig.ca.tlsca.portHost : ordererConfig.ca.portHost;
	const caHost = 'localhost';
	const caProtocol = TLS ? 'https://' : 'http://';

	const caUrl = `${caProtocol}${caHost}:${ca_port}`;
	return caUtil.new(caUrl);

};
const getCaService = ({orgName}) => {
	const orgConfig = globalConfig.orgs[orgName];
	const {TLS} = globalConfig;
	const ca_port = TLS ? orgConfig.ca.tlsca.portHost : orgConfig.ca.portHost;
	const caHost = 'localhost';
	const caProtocol = TLS ? 'https://' : 'http://';

	const caUrl = `${caProtocol}${caHost}:${ca_port}`;
	// const org_domain=`${orgName}.${COMPANY_DOMAIN}`
	// const tlscaCert=path.join(CRYPTO_CONFIG_DIR,'peerOrganizations',org_domain,'tlsca',`tlsca.${org_domain}-cert.pem`)
	// const trustedRoots=[fs.readFileSync(tlscaCert).toString()] //fixme  Error: Calling register endpoint failed with error [Error: Hostname/IP doesn't match certificate's altnames: "Host: localhost. is not cert's CN: tlsca.BU.Delphi.com"]
	return caUtil.new(caUrl);
};
exports.getCaService = getCaService;

exports.setCAAdmin = setCAAdminUser;