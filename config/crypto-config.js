const globalConfig = require('./orgs.json');
const fs = require('fs');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
exports.gen = ({
	cryptoConfigFile = path.resolve(CURRENT, 'crypto-config.yaml')
}) => {
	const COMPANY_DOMAIN = globalConfig.domain;
	const ordererConfig = globalConfig.orderer;
	const orgsConfig = globalConfig.orgs;
	if(fs.existsSync(cryptoConfigFile)){
		fs.unlinkSync(cryptoConfigFile);
	}
	const OrdererOrgs = [];
	if(ordererConfig.type ==='kafka'){
		for(const ordererOrgName in globalConfig.orderer.kafka.orgs){
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrgName];

			const Specs = Object.keys(ordererOrgConfig.orderers).map((ordererHost)=>{
				return {Hostname: ordererHost};
			});
			OrdererOrgs.push({
				Domain:ordererOrgName,
				Specs,
			});
		}

	}else {
		OrdererOrgs.push({
			Domain: COMPANY_DOMAIN,
			Specs: [{Hostname: ordererConfig.solo.container_name}]
		});
	}

	const PeerOrgs = [];
	for (const orgName in orgsConfig) {
		const orgConfig = orgsConfig[orgName];
		PeerOrgs.push({
			Domain: `${orgName}.${COMPANY_DOMAIN}`,
			Template: {
				Start: 0,
				Count: orgConfig.peers.length
			},
			Users: {
				Count: 0
			}
		});
	}
	fs.writeFileSync(cryptoConfigFile, yaml.safeDump({PeerOrgs, OrdererOrgs}));

};
//TODO temporary before refactor to fabric-ca key gen
exports.newOrg = ({Name, Domain, Count = 1, CRYPTO_UPDATE_CONFIG = path.resolve(CURRENT, 'crypto-config-update.yaml')}) => {
	if(fs.existsSync(CRYPTO_UPDATE_CONFIG)){
		fs.unlinkSync(CRYPTO_UPDATE_CONFIG);
	}
	const PeerOrgs = [{
		Name, Domain, Template: {
			Start: 0,
			Count
		},
		Users: {
			Count: 0
		}
	}];
	fs.writeFileSync(CRYPTO_UPDATE_CONFIG, yaml.safeDump({PeerOrgs}));

};