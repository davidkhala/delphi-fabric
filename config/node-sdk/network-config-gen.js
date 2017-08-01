const fs = require('fs')
const program = require('commander')
const config = require('../orgs.json')

const args = process.argv.slice(2)
const path = require('path')

program.option('-c, --crypto-config [type]', 'set crypto config directory').
		option('-o, --output-file [type]', 'set output JSON file path').
		parse(process.argv)

let CRYPTO_CONFIG_DIR = path.join(__dirname, '../crypto-config')
let COMPANY = 'delphi'
let JSONOUTPUT = './test.json'
if (args[0]) {
	COMPANY = args[0]
}
if (program.cryptoConfig) {
	CRYPTO_CONFIG_DIR = program.cryptoConfig
}
if (program.outputFile) {
	JSONOUTPUT = program.outputFile
}
console.log({ COMPANY, CRYPTO_CONFIG_DIR, JSONOUTPUT })

const companyObj = config[COMPANY]

const COMPANY_DOMAIN = companyObj.domain
const orderer_hostName = companyObj.orderer.containerName.toLowerCase()
const orderer_hostName_full = `${orderer_hostName}.${COMPANY_DOMAIN}`

const orderer = {}
orderer.serverHostName = orderer_hostName_full
orderer.tls_cacerts = `${CRYPTO_CONFIG_DIR}/ordererOrganizations/${COMPANY_DOMAIN}/orderers/${orderer_hostName_full}/tls/ca.crt`
orderer.url = 'grpcs://localhost:7050'// TODO to test

const networkConfig = { orderer }

const orgs = companyObj.orgs

networkConfig.organizations = {}
for (let org in orgs) {
	const outputOrg = {}
	let item = orgs[org]
	//org.name is redundent?
	outputOrg.mspid = item.MSP.id
	const ca_port = item.ca.portMap[0].host
	outputOrg.ca = `https://localhost:${ca_port}`

	const org_domain = `${org.toLowerCase()}.${COMPANY_DOMAIN}`// bu.delphi.com
	const key = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/users/Admin@${org_domain}/msp/keystore`
	const cert = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/users/Admin@${org_domain}/msp/signcerts`
	outputOrg.admin = { key, cert }
	outputOrg.peers = []

	for (let [index, peer] of item.peers.entries()) {
		const peerOutput = {}
		for (let portMapEach of peer.portMap) {
			if (portMapEach.container === 7051) {
				peerOutput.requests = `grpcs://localhost:${portMapEach.host}`
			} else if (portMapEach.container === 7053) {
				peerOutput.events = `grpcs://localhost:${portMapEach.host}`
			}
		}

		const peer_hostName_full = `peer${index}.${org_domain}`
		peerOutput.serverHostName = peer_hostName_full
		peerOutput.tls_cacerts = `${CRYPTO_CONFIG_DIR}/peerOrganizations/${org_domain}/peers/${peer_hostName_full}/tls/ca.crt`
		peerOutput.containerName = peer.containerName

		outputOrg.peers.push(peerOutput)

	}

	networkConfig.organizations[org] = outputOrg
	//org1 is for username=Jim&orgName=org1

}

const output = { 'network-config': networkConfig }
fs.writeFileSync(JSONOUTPUT, JSON.stringify(output), 'utf8')


