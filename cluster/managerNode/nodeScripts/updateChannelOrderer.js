const Request = require('request');
const helper = require('../../../app/helper');
const clientUtil = require('../../../app/util/client');
const peerUtil = require('../../../app/util/peer');
const userUtil = require('../../../app/util/user');
const pathUtil = require('../../../app/util/path');
const config = require('./config');
const {CryptoPath} = pathUtil;

const ordererClient = clientUtil.new();
const channelName = 'allChannel';
const ordererOrgName = 'NewConsensus';
const orderAdminName = 'Admin';
const cryptoPath = new CryptoPath(config.MSPROOT, {orderer: {org: ordererOrgName}, user: {name: orderAdminName,}});

userUtil.loadFromLocal(cryptoPath.ordererUserMSP(),ordererClient.getCryptoSuite(),{username:orderAdminName,domain:ordererOrgName,
	mspId:config.orderer.orgs[ordererOrgName].MSP.id}).then(ordererAdmin =>{
	ordererClient.setUserContext(ordererAdmin,true).then(()=>{
		const channel = ordererClient.newChannel(channelName);
		console.log(channel.initialize());
	});
});

