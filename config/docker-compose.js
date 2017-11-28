const globalConfig = require('./orgs.json')
const fs = require('fs')
const path = require('path')
const CURRENT = __dirname
const yaml = require('js-yaml')
const swarmServiceName = (serviceName) => {
    return serviceName.replace(".", "-")
}
exports.gen = ({
                   COMPANY,
                   MSPROOT,
                   arch = 'x86_64',
                   BLOCK_FILE,
                   COMPOSE_FILE = path.resolve(CURRENT, 'docker-compose.yaml'),
                   type = 'local'
               }) => {

    const companyConfig = globalConfig[COMPANY]
    const {TLS, docker: {fabricTag, volumes: volumeConfig, network}} = companyConfig
    const IMAGE_TAG = `${arch}-${fabricTag}`

    const dockerSock = '/host/var/run/docker.sock'
    const orgsConfig = companyConfig.orgs
    const COMPANY_DOMAIN = companyConfig.domain
    const ordererConfig = companyConfig.orderer
    const CONFIGTXVolume = volumeConfig.CONFIGTX[type]
    const MSPROOTVolume = volumeConfig.MSPROOT[type]
    // const ordererContainerPort = ordererConfig.portMap[0].container
    const container =
        {
            dir: {
                CONFIGTX: "/etc/hyperledger/configtx",
                MSPROOT: "/etc/hyperledger/crypto-config",
                CA_HOME:"/etc/hyperledger/fabric-ca-server",
            }
        }
    fs.unlinkSync(COMPOSE_FILE)


    let ordererServiceName = `OrdererServiceName.${COMPANY_DOMAIN}`
    const ordererService = {
        image: `hyperledger/fabric-orderer:${IMAGE_TAG}`,
        command: "orderer",
        ports: [`${ordererConfig.portMap[0].host}:7050`],
        volumes: [`${CONFIGTXVolume}:${container.dir.CONFIGTX}`,
            `${MSPROOTVolume}:${container.dir.MSPROOT}`]
    }
    if (type === 'swarm') {
        ordererServiceName = swarmServiceName(ordererServiceName)

    } else {
        ordererService.container_name = ordererConfig.containerName
        ordererService.networks = ["default"]
    }

    let ORDERER_GENERAL_TLS_ROOTCAS = "${CONTAINER_ORDERER_TLS_DIR}/ca.crt"

    for (let orgName in orgsConfig) {
        const orgConfig = orgsConfig[orgName]
        const orgDomain = `${orgName}.${COMPANY_DOMAIN}`
        const peersConfig = orgConfig.peers
        for (let peerIndex in peersConfig) {
            const peerDomain = `peer${peerIndex}.${orgDomain}`
            const peerConfig = peersConfig[peerIndex]

            const PEER_STRUCTURE = `peerOrganizations/${orgDomain}/peers/${peerDomain}`
            const environment =
                [
                    `CORE_VM_ENDPOINT=unix://${dockerSock}`,
                    `CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=${network}`,
                    'CORE_LOGGING_LEVEL=DEBUG',
                    'CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true',
                    'CORE_PEER_GOSSIP_USELEADERELECTION=true',
                    'CORE_PEER_GOSSIP_ORGLEADER=false',
                    `CORE_PEER_GOSSIP_EXTERNALENDPOINT=${peerDomain}:7051`, // FIXME take care!
                    `CORE_PEER_LOCALMSPID=${orgConfig.MSP.id}`,
                    `CORE_PEER_MSPCONFIGPATH=${container.dir.MSPROOT}/${PEER_STRUCTURE}/msp`,
                    `CORE_PEER_TLS_ENABLED=${TLS}`,
                    `CORE_PEER_ID=${peerDomain}`,
                    `CORE_PEER_ADDRESS=${peerDomain}:7051`,
                    `GODEBUG=netdns=go`,//NOTE aliyun only
                ]
            if (TLS) {
                environment.push([
                    `CORE_PEER_TLS_KEY_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/server.key`,
                    `CORE_PEER_TLS_CERT_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/server.crt`,
                    `CORE_PEER_TLS_ROOTCERT_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/ca.crt`
                ])
            }
            const ports = []
            for (let portIndex in peerConfig.portMap) {
                const entry = peerConfig.portMap[portIndex]
                ports.push(`${entry.host}:${entry.container}`)
            }
            const peerService = {
                depends_on: [ordererServiceName],
                image: `hyperledger/fabric-peer:${IMAGE_TAG}`,
                command: "peer node start",
                environment,
                ports,
                volumes: [`/run/docker.sock:${dockerSock}`,
                    `${MSPROOTVolume}:${container.dir.MSPROOT}`]
            }

            let peerServiceName = peerDomain

            if (type === 'swarm') {
                peerServiceName = swarmServiceName(peerServiceName)
            } else {
                peerService.container_name = peerConfig.containerName
                peerService.networks = ['default']
            }


        }
        const caConfig= orgConfig.ca
        if(caConfig.enable){
            ORDERER_GENERAL_TLS_ROOTCAS +=`,${container.dir.MSPROOT}/peerOrganizations/${orgDomain}/tlsca/tlsca.${orgDomain}-cert.pem"`
        //    FIXME? tlsca? what is this for

            const CAVolume = path.join(MSPROOT,'peerOrganizations',orgDomain,'ca')
            const caServerConfig =path.resolve(CAVolume,"fabric-ca-server-config.yaml")
            fs.unlinkSync(caServerConfig)
            //TODO
            // caPrivkeyFilename=$(basename $(find $CA_HOST_VOLUME/ca -type f \( -name "*_sk" \)))
        }

    }


    fs.writeFileSync(COMPOSE_FILE, yaml.safeDump({
        version: 3,
        volumes: {
            networks: {
                default: {
                    external: {
                        name: network
                    }
                }
            },
            [MSPROOTVolume]: {
                external: true
            },
            [CONFIGTXVolume]: {
                external: true
            }
        }

    }, {lineWidth: 180}))

}