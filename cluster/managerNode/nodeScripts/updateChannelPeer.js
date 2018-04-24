const Request = require('request');
const fs = require('fs');
const helper = require('../../../app/helper');
const clientUtil = require('../../../app/util/client');
const peerUtil = require('../../../app/util/peer');
const userUtil = require('../../../app/util/user');
const pathUtil = require('../../../app/util/path');
const config = require('./config');
const {CryptoPath} = pathUtil;

const peerClient = clientUtil.new();
const channelName = 'allChannel';
const peerOrgName = 'NEW';
const peerAdminName = 'admin';
const cryptoPath = new CryptoPath(config.MSPROOT, {peer: {org: peerOrgName}, user: {name: peerAdminName,}});


const formData ={
	admins:[fs.createReadStream(cryptoPath.peerUserMSPSigncert())],
	root_certs:[fs.createReadStream(cryptoPath.peerCacerts())],
	tls_root_certs:[],
	channelName,
	MSPID:config.orgs[peerOrgName].MSP.id,
	MSPName:config.orgs[peerOrgName].MSP.name,
};
Request.post({url:`${config.swarmServer.url}:${config.swarmServer.port}/channel/newOrg`,formData},(err,resp,body)=>{
	console.log(err,body);
});

