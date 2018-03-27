const globalConfig = require('./orgs.json');
const fs = require('fs');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
exports.gen = ({
                   consortiumName = "SampleConsortium",
                   MSPROOT,
                   PROFILE_BLOCK = `delphiGenesis`,
                   configtxFile = path.resolve(CURRENT, 'configtx.yaml')

               }) => {
    const companyConfig = globalConfig;
    const channelsConfig = companyConfig.channels;
    const COMPANY_DOMAIN = companyConfig.domain;
    const ordererConfig = companyConfig.orderer;

//	refresh configtxFile
    if (fs.existsSync(configtxFile)) {
        fs.unlinkSync(configtxFile);
    }


    const blockProfileConfig = {
        Orderer: {
            OrdererType: 'solo',

            Addresses: [`${ordererConfig.solo.container_name}:${ordererConfig.solo.portMap[7050]}`],
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
    };
    if (companyConfig.orderer.type === "kafka") {
        blockProfileConfig.Orderer.OrdererType = "kafka";

        blockProfileConfig.Orderer.Addresses = Object.keys(globalConfig.orderer.kafka.orderers)
            .map((orderer) => `${orderer}:7050`);

        blockProfileConfig.Orderer.Kafka = {
            Brokers: Object.keys(globalConfig.orderer.kafka.kafkas).map((kafka) => `${kafka}:9092`)
        };
    }
    const orgsConfig = companyConfig.orgs;
    const Organizations = [];

    const OrganizationBuilder = (orgName) => {
        const orgConfig = orgsConfig[orgName];
        const anchorPeerConfig = orgConfig.peers[0];
        return {
            Name: orgConfig.MSP.name,
            ID: orgConfig.MSP.id,
            MSPDir: path.join(MSPROOT, 'peerOrganizations', `${orgName}.${COMPANY_DOMAIN}`, 'msp'),
            AnchorPeers: [{
                Host: anchorPeerConfig.container_name,
                Port: 7051
            }]
        };
    };
    for (let orgName in orgsConfig) {
        Organizations.push(OrganizationBuilder(orgName));
    }
    blockProfileConfig.Consortiums = {
        [consortiumName]: {
            Organizations
        }
    };

    const Profiles = {
        [PROFILE_BLOCK]: blockProfileConfig
    };
    //Write channel profiles
    const channelsProfileConfig = {};
    for (let channelName in channelsConfig) {
        const channelConfig = channelsConfig[channelName];
        const PROFILE_CHANNEL = channelName;
        const Organizations = [];
        for (let orgName in channelConfig.orgs) {
            Organizations.push(OrganizationBuilder(orgName));
        }
        Profiles[PROFILE_CHANNEL] = {
            Consortium: consortiumName,
            Application: {
                Organizations
            }
        };

    }

    fs.writeFileSync(configtxFile, yaml.safeDump({Profiles}, {lineWidth: 180}));

};
