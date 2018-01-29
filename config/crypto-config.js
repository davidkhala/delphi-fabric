const globalConfig = require('./orgs.json')
const fs = require('fs')
const path = require('path')
const CURRENT = __dirname
const yaml = require('js-yaml')
exports.gen = ({
                   COMPANY,
                   cryptoConfigFile = path.resolve(CURRENT, 'crypto-config.yaml')
               }) => {
    const companyConfig = globalConfig[COMPANY]
    const COMPANY_DOMAIN = companyConfig.domain
    const ordererConfig = companyConfig.orderer
    const orgsConfig = companyConfig.orgs
    if(fs.existsSync(cryptoConfigFile)){
        fs.unlinkSync(cryptoConfigFile)
    }
    const OrdererOrgs = [{
        Name: 'OrdererCrytoName',
        Domain: COMPANY_DOMAIN,
        Specs: [
            {Hostname: ordererConfig.container_name}
        ]
    }]
    const PeerOrgs = []
    for (let orgName in orgsConfig) {
        const orgConfig = orgsConfig[orgName]
        PeerOrgs.push({
            Name: orgName,
            Domain: `${orgName}.${COMPANY_DOMAIN}`,
            Template: {
                Start: 0,
                Count: orgConfig.peers.length
            },
            Users: {
                Count: orgConfig.userCount
            }
        })
    }
    fs.writeFileSync(cryptoConfigFile, yaml.safeDump({PeerOrgs, OrdererOrgs}))

}
//TODO temporary before refactor to fabric-ca key gen
exports.newOrg = ({Name, Domain, Count = 1, CRYPTO_UPDATE_CONFIG = path.resolve(CURRENT, 'crypto-config-update.yaml')}) => {
    if(fs.existsSync(CRYPTO_UPDATE_CONFIG)){
        fs.unlinkSync(CRYPTO_UPDATE_CONFIG)
    }
    const PeerOrgs = [{
        Name, Domain, Template: {
            Start: 0,
            Count
        },
        Users: {
            Count: 0
        }
    }]
    fs.writeFileSync(CRYPTO_UPDATE_CONFIG, yaml.safeDump({PeerOrgs}))

}