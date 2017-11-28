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
    const channelsConfig = companyConfig.channels
    const COMPANY_DOMAIN = companyConfig.domain
    const ordererConfig = companyConfig.orderer
    const orgsConfig = companyConfig.orgs
    fs.unlinkSync(cryptoConfigFile)
    const OrdererOrgs = [{
        Name: 'OrdererCrytoName',
        Domain: COMPANY_DOMAIN,
        Specs: [
            {Hostname: ordererConfig.containerName}
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