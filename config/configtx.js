const globalConfig = require('./orgs.json')
const fs = require('fs')
const path = require('path')
const CURRENT = __dirname
const yaml = require('js-yaml')
exports.gen = ({
                   consortiumName = "SampleConsortium",
                   COMPANY, MSPROOT,
                   PROFILE_BLOCK = `${COMPANY}Genesis`,
                   configtxFile = path.resolve(CURRENT, 'configtx.yaml')

               }) => {
    const companyConfig = globalConfig[COMPANY]
    const channelsConfig = companyConfig.channels
    const COMPANY_DOMAIN = companyConfig.domain
    const ordererConfig = companyConfig.orderer
    const ordererContainerPort = ordererConfig.portMap[0].container

//	refresh configtxFile
    fs.unlinkSync(configtxFile)


    const blockProfileConfig = {
        Orderer: {
            OrdererType: 'solo',
            Addresses: [`${ordererConfig.containerName}:${ordererContainerPort}`],
            BatchTimeout: '2s',
            BatchSize: {
                MaxMessageCount: 10,
                AbsoluteMaxBytes: '99 MB',
                PreferredMaxBytes: '512 KB'
            },
            Organizations: [
                {
                    Name: ordererConfig.MSP.name, ID: ordererConfig.MSP.id,
                    MSPDir: path.join(MSPROOT, 'ordererOrganizations', COMPANY_DOMAIN, 'msp')
                }
            ]
        }
    }
    const orgsConfig = companyConfig.orgs
    const Organizations = []

    const OrganizationBuilder = (orgName) => {
        const orgConfig = orgsConfig[orgName]
        const anchorPeerConfig = orgConfig.peers[0]
        return {
            Name: orgConfig.MSP.name,
            ID: orgConfig.MSP.id,
            MSPDir: path.join(MSPROOT, 'peerOrganizations', `${orgName}.${COMPANY_DOMAIN}`, 'msp'),
            AnchorPeers: [{
                Host: anchorPeerConfig.containerName,
                Port: 7051
            }]
        }
    }
    for (let orgName in orgsConfig) {
        Organizations.push(OrganizationBuilder(orgName))
    }
    blockProfileConfig.Consortiums = {
        [consortiumName]: {
            Organizations
        }
    }

    const Profiles = {
        [PROFILE_BLOCK]: blockProfileConfig
    }
    //Write channel profiles
    const channelsProfileConfig = {}
    for (let channelName in channelsConfig) {
        const channelConfig = channelsConfig[channelName]
        const PROFILE_CHANNEL = channelName
        const Organizations = []
        for (let orgName in channelConfig.orgs) {
            Organizations.push(OrganizationBuilder(orgName))
        }
        Profiles[PROFILE_CHANNEL] = {
            Consortium: consortiumName,
            Application: {
                Organizations
            }
        }

    }

    fs.writeFileSync(configtxFile, yaml.safeDump({Profiles}, {lineWidth: 180}))

}
