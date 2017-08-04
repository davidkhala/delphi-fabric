const installchaincode = require('./install-chaincode')
const instantiateChaincode = require('./instantiate-chaincode')
const program = require('commander')
const args = process.argv.slice(2)

let adminOrg = 'BU'
let CHAINCODE_NAME = 'delphiChaincode'
let VERSION = 'v0'
let CHAINCODE_PATH = 'github.com/delphi'

let containerNames = ['BUContainerName']

if (args[0]) containerNames = JSON.parse(args[0])
if (args[1]) CHAINCODE_NAME = args[1]
if (args[2]) CHAINCODE_PATH = args[2]
if (args[3]) adminOrg = args[3]

program.option('-v, --chaincode-version [type]', 'set chaincode version').
		parse(process.argv)
if (program.chaincodeVersion) VERSION = program.chaincodeVersion

installchaincode.installChaincode(containerNames, CHAINCODE_NAME, CHAINCODE_PATH,
		VERSION
		, 'anyone', adminOrg)

const containerName = containerNames[0]
const chaincode_args = []
instantiateChaincode.instantiateChaincode(containerName, CHAINCODE_NAME, VERSION, chaincode_args,
		'david', adminOrg).then(function(message) {
	res.send(message)
})

//todo query installed
