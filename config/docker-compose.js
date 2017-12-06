const globalConfig = require('./orgs.json')
const fs = require('fs')
const path = require('path')
const CURRENT = __dirname
const yaml = require('js-yaml')
const helper = require('../app/helper')
const logger = require('../app/util/logger').new('compose-gen')
const swarmServiceName = (serviceName) => {
	return serviceName.replace(/\./g, '-')
}
exports.gen = ({
								 COMPANY,
								 MSPROOT,
								 arch = 'x86_64',
								 COMPOSE_FILE = path.resolve(CURRENT, 'docker-compose.yaml'),
								 type = 'local'
							 }) => {

	logger.debug({ COMPANY, MSPROOT, arch, COMPOSE_FILE, type })

	const companyConfig = globalConfig[COMPANY]
	const { TLS, docker: { fabricTag, volumes: volumeConfig, network } } = companyConfig
	const IMAGE_TAG = `${arch}-${fabricTag}`

	const dockerSock = '/host/var/run/docker.sock'
	const orgsConfig = companyConfig.orgs
	const COMPANY_DOMAIN = companyConfig.domain
	const ordererConfig = companyConfig.orderer
	const BLOCK_FILE = ordererConfig.genesis_block.file
	const CONFIGTXVolume = volumeConfig.CONFIGTX[type]
	const MSPROOTVolume = volumeConfig.MSPROOT[type]
	// const ordererContainerPort = ordererConfig.portMap[0].container
	const container =
			{
				dir: {
					CONFIGTX: '/etc/hyperledger/configtx',
					MSPROOT: '/etc/hyperledger/crypto-config',
					CA_HOME: '/etc/hyperledger/fabric-ca-server'
				}
			}
	if (fs.existsSync(COMPOSE_FILE)) {
		fs.unlinkSync(COMPOSE_FILE)
	}

	const services = {}
	let ordererServiceName = `OrdererServiceName.${COMPANY_DOMAIN}`
	const ORDERER_STRUCTURE = `ordererOrganizations/${COMPANY_DOMAIN}/orderers/${ordererConfig.container_name}.${COMPANY_DOMAIN}`
	const ordererService = {
		image: `hyperledger/fabric-orderer:${IMAGE_TAG}`,
		command: 'orderer',
		ports: [`${ordererConfig.portMap[0].host}:7050`],
		volumes: [
			`${CONFIGTXVolume}:${container.dir.CONFIGTX}`,
			`${MSPROOTVolume}:${container.dir.MSPROOT}`],
		environment: [
			'ORDERER_GENERAL_LOGLEVEL=debug',
			'ORDERER_GENERAL_LISTENADDRESS=0.0.0.0',// TODO useless checking
			`ORDERER_GENERAL_TLS_ENABLED=${TLS}`,
			'ORDERER_GENERAL_GENESISMETHOD=file',
			`ORDERER_GENERAL_GENESISFILE=${container.dir.CONFIGTX}/${BLOCK_FILE}`,
//  NOTE remove ORDERER_GENERAL_GENESISFILE: panic: Unable to bootstrap orderer. Error reading genesis block file: open /etc/hyperledger/fabric/genesisblock: no such file or directory
// NOTE when ORDERER_GENERAL_GENESISMETHOD=provisional  ORDERER_GENERAL_GENESISPROFILE=SampleNoConsortium -> panic: No system chain found.  If bootstrapping, does your system channel contain a consortiums group definition
			'ORDERER_GENERAL_LOCALMSPID=OrdererMSP',// FIXME hardcode MSP name
			`ORDERER_GENERAL_LOCALMSPDIR=${container.dir.MSPROOT}/${ORDERER_STRUCTURE}/msp`,
			'GODEBUG=netdns=go' // aliyun only

		]
	}

	if (type === 'swarm') {
		ordererServiceName = swarmServiceName(ordererServiceName)
		ordererService.networks = {
			default: {
				aliases: [ordererConfig.container_name]
			}
		}
		//TODO network map service here

	} else {
		ordererService.container_name = ordererConfig.container_name
		ordererService.networks = ['default']
	}

	let ORDERER_GENERAL_TLS_ROOTCAS = `${container.dir.MSPROOT}/${ORDERER_STRUCTURE}/tls/ca.crt` //TODO this is required when using fabric-ca service with tlsca.* root identity to register/enroll identity

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
						`GODEBUG=netdns=go`//NOTE aliyun only
					]
			if (TLS) {
				environment.push(`CORE_PEER_TLS_KEY_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/server.key`)
				environment.push(`CORE_PEER_TLS_CERT_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/server.crt`)
				environment.push(`CORE_PEER_TLS_ROOTCERT_FILE=${container.dir.MSPROOT}/${PEER_STRUCTURE}/tls/ca.crt`)
			}
			const ports = []
			for (let portIndex in peerConfig.portMap) {
				const entry = peerConfig.portMap[portIndex]
				ports.push(`${entry.host}:${entry.container}`)
			}
			const peerService = {
				depends_on: [ordererServiceName],
				image: `hyperledger/fabric-peer:${IMAGE_TAG}`,
				command: 'peer node start',
				environment,
				ports,
				volumes: [
					`/run/docker.sock:${dockerSock}`,
					`${MSPROOTVolume}:${container.dir.MSPROOT}`]
			}

			let peerServiceName = peerDomain

			if (type === 'swarm') {
				peerServiceName = swarmServiceName(peerServiceName)
				peerService.networks = {
					default: {
						aliases: [peerDomain]
					}
				}
				//TODO network map service here
				peerService.deploy={
					placement:{
						constraints:peerConfig.swarm.constraints
					}
				}
			} else {
				peerService.container_name = peerConfig.container_name
				peerService.networks = ['default']
			}
			services[peerServiceName] = peerService

		}
		const caConfig = orgConfig.ca
		if (caConfig.enable) {


			const CAVolume = path.join(MSPROOT, 'peerOrganizations', orgDomain, 'ca')
			const caServerConfigFile = path.resolve(CAVolume, 'fabric-ca-server-config.yaml')
			if (fs.existsSync(caServerConfigFile)) {
				fs.unlinkSync(caServerConfigFile)
			}
			const caPrivateKey = helper.findKeyfiles(CAVolume)[0]
			const caServerConfig = {
				affiliations: {
					[orgName]: ['client', 'user', 'peer']
				},
				tls: {
					enabled: TLS
				},
				registry: {
					identities: [
						{
							type: 'client',
							name: caConfig.admin.name,
							pass: caConfig.admin.pass,
							maxenrollments: -1,
							attrs: {
								'hf.Registrar.Roles': 'client,user,peer',
								'hf.Revoker': true,
								'hf.Registrar.DelegateRoles': 'client,user',
								'hf.Registrar.Attributes': '*'
							}
						}]
				},
				ca: {
					certfile: `${container.dir.CA_HOME}/ca.$ORG_DOMAIN-cert.pem`,
					keyfile: `${container.dir.CA_HOME}/${path.basename(caPrivateKey)}`
				}
			}

			let caContainerName

			if (TLS) {
				//    FIXME? tlsca? what is this for
				ORDERER_GENERAL_TLS_ROOTCAS += `,${container.dir.MSPROOT}/peerOrganizations/${orgDomain}/tlsca/tlsca.${orgDomain}-cert.pem`
				caContainerName = `tlsca.${orgDomain}`
				caServerConfig.tls = {
					certfile: `${container.dir.CA_HOME}/ca.$ORG_DOMAIN-cert.pem`,
					keyfile: `${container.dir.CA_HOME}/${path.basename(caPrivateKey)}`
				}
			} else {
				caContainerName = `ca.${orgDomain}`

			}
			const caService = {
				image: `hyperledger/fabric-ca:${IMAGE_TAG}`,
				command: 'sh -c \'fabric-ca-server start -d\'',
				volumes: [`${CAVolume}:${container.dir.CA_HOME}`],
				ports: [`${caConfig.portHost}:7054`],
				environment: [
					`FABRIC_CA_HOME=${container.dir.CA_HOME}`,
					'GODEBUG=netdns=go'//NOTE aliyun only
				]
			}
			let caServiceName = caContainerName
			if (type === 'swarm') {
				caService.networks = {
					default: {
						aliases: [caContainerName]
					}
				}
				caServiceName = swarmServiceName(caServiceName)
				//TODO network map service here

			} else {
				caService.container_name = caContainerName
				caService.networks = ['default']

			}
			services[caServiceName] = caService
			fs.writeFileSync(caServerConfigFile, yaml.safeDump(caServerConfig, { lineWidth: 180 }))

		}

	}

	if (TLS) {
		ordererService.environment.push(
				`ORDERER_GENERAL_TLS_PRIVATEKEY=${container.dir.MSPROOT}/${ORDERER_STRUCTURE}/tls/server.key`)
		ordererService.environment.push(
				`ORDERER_GENERAL_TLS_CERTIFICATE=${container.dir.MSPROOT}/${ORDERER_STRUCTURE}/tls/server.crt`)
		ordererService.environment.push(`ORDERER_GENERAL_TLS_ROOTCAS=[${ORDERER_GENERAL_TLS_ROOTCAS}]`)
	}
	services[ordererServiceName] = ordererService

	fs.writeFileSync(COMPOSE_FILE, yaml.safeDump({
		//only version 3 support network setting
		version: '3', //ERROR: Version in "/home/david/Documents/delphi-fabric/config/docker-compose.yaml" is invalid - it should be a string.
		volumes: {
			[MSPROOTVolume]: {
				external: true
			},
			[CONFIGTXVolume]: {
				external: true
			}
		},
		networks: {
			default: {
				external: {
					name: network
				}
			}
		},
		services

	}, { lineWidth: 180 }))

}
