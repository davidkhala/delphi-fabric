const installchaincode = require('./install-chaincode')
const instantiateChaincode = require('./instantiate-chaincode')
const invokechaincode=require('./invoke-chaincode')
const program = require('commander')
const args = process.argv.slice(2)

let adminOrg = 'BU'
let CHAINCODE_NAME = 'delphiChaincode'
let VERSION = 'v0'
let CHAINCODE_PATH = 'github.com/delphi'

let containerNames = ['BUContainerName']

let ACTION = 'install'

if (args[0]) ACTION = args[0]
if (args[1]) containerNames = JSON.parse(args[1])
if (args[2]) CHAINCODE_NAME = args[2]
if (args[3]) CHAINCODE_PATH = args[3]
if (args[4]) adminOrg = args[4]

program.option('-v, --chaincode-version [type]', 'set chaincode version').
		parse(process.argv)
if (program.chaincodeVersion) VERSION = program.chaincodeVersion

let CHANNEL_NAME = 'delphichannel'
switch (ACTION) {
	case 'install':
		installchaincode.installChaincode(containerNames, CHAINCODE_NAME, CHAINCODE_PATH,
				VERSION
				, 'anyone', adminOrg)
		break
	case 'instantiate':

		const containerName = containerNames[0]
		const chaincode_args = []
		instantiateChaincode.resetChaincode(containerName, CHAINCODE_NAME, VERSION).then((data) => {
			console.log('remove return data', data)
			return instantiateChaincode.instantiateChaincode(CHANNEL_NAME, containerName, CHAINCODE_NAME, VERSION,
					chaincode_args,
					'david', adminOrg)
		})
		break
	case 'invoke':
		//todo to test
		// (channelName, containerNames, chaincodeName, fcn, args, username, org)
		invokechaincode.invokeChaincode(CHANNEL_NAME,[containerNames[0]],CHAINCODE_NAME,
				'any',[],'david',adminOrg)
		break
}

//todo query installed
