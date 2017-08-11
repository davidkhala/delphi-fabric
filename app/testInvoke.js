const invokechaincode = require('./invoke-chaincode')
const program = require('commander')
const args = process.argv.slice(2)

let adminOrg = 'BU'
let containerName = 'BUContainerName'
let CHAINCODE_NAME = 'adminChaincode'

let VERSION = 'v0'

let fcn = 'chaincode'
let chaincode_args = ['reset', CHAINCODE_NAME]

if (args[0]) CHAINCODE_NAME = args[0]
if (args[1]) adminOrg = args[1]
if (args[2]) containerName = args[2]
if (args[3]) fcn = args[3]
if (args[4]) chaincode_args = JSON.parse(args[4])

program.option('-v, --chaincode-version [type]', 'set chaincode version').
		parse(process.argv)
if (program.chaincodeVersion) VERSION = program.chaincodeVersion

let CHANNEL_NAME = 'delphichannel'

//todo to test
// (channelName, containerNames, chaincodeName, fcn, args, username, org)
invokechaincode.invokeChaincode(CHANNEL_NAME, [containerName], CHAINCODE_NAME, fcn,
		['list'], 'david', adminOrg)

//todo query installed
