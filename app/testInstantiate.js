const instantiateChaincode = require('./instantiate-chaincode')
const program = require('commander')
const args = process.argv.slice(2)

let adminOrg = 'BU'
let containerName = 'BUContainerName'
let CHAINCODE_NAME = 'adminChaincode'
const CC_CONFIG = require('../config/chaincode.json').chaincodes[CHAINCODE_NAME]
let VERSION = 'v0'

let chaincode_args = []
if (args[0]) CHAINCODE_NAME = args[0]
if (args[1]) adminOrg = args[1]
if (args[2]) containerName= args[2]
program.option('-v, --chaincode-version [type]', 'set chaincode version').
		option(' -r, --reset','set reset flag').
		parse(process.argv)
if (program.chaincodeVersion) VERSION = program.chaincodeVersion


let CHANNEL_NAME = 'delphichannel'



if(program.reset){
	instantiateChaincode.resetChaincode(containerName, CHAINCODE_NAME, VERSION).then((data) => {
		return instantiateChaincode.instantiateChaincode(CHANNEL_NAME, containerName, CHAINCODE_NAME, VERSION,
				chaincode_args,
				'david', adminOrg)
	})
}else {
	instantiateChaincode.instantiateChaincode(CHANNEL_NAME, containerName, CHAINCODE_NAME, VERSION,
			chaincode_args,
			'david', adminOrg)
}


//TODO reset not ready


//todo query installed
