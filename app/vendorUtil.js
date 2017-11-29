// NOTE Invoke action cannot be performed on peer without chaincode installed(no matter whether chaincode has been instantiated on this peer): Error: cannot retrieve package for chaincode adminChaincode/v0, error open /var/hyperledger/production/chaincodes/adminChaincode.v0: no such file or directory

const Invoke = require('./invoke-chaincode').invokeChaincode
const Query = require('./invoke-chaincode').query
const helper = require('./helper')

const logger = require('./util/logger').new('vendor')
const Install = require('./install-chaincode').install
const UpdateInstall = require('./install-chaincode').updateInstall
const Instantiate = require('./instantiate-chaincode').instantiate
const chaincodeId = 'vendorChaincode'
const channelName = 'delphiChannel'

const chaincodeConfig = require('../config/chaincode.json')

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path

const client = helper.getClient()
exports.invoke = ({ orgName, fcn, args }) => {
	return helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client, true)
		const peers = helper.newPeers([0], orgName) //NOTE hardcode
		return Invoke(channel, peers, { chaincodeId, fcn, args })
	}).then(require('./invoke-chaincode').reducer)

}
exports.query = ({orgName,fcn,args})=>{
	return helper.getOrgAdmin(orgName,client).then(()=>{
		const channel = helper.prepareChannel(channelName, client, true)
		const peers = helper.newPeers([0], orgName) //NOTE hardcode
		return Query(channel, peers, { chaincodeId, fcn, args })
	})
}

exports.upgradeInstall = ({ orgName }) => {
	return helper.getOrgAdmin(orgName, client).then(() => {
		const peers = helper.newPeers([0], orgName) //NOTE hardcode
		return UpdateInstall(peers, { chaincodeId }, client)
	})
}
exports.firstInstall = ({ orgName }) => {
	return helper.getOrgAdmin(orgName, client).then(() => {
		const peers = helper.newPeers([0], orgName)  //NOTE hardcode
		return Install(peers, { chaincodeId, chaincodePath, chaincodeVersion: 'v0' }, client)
	})

}

exports.instantiate = ({ orgName, args }) => {
	return helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client, true)
		const peers = helper.newPeers([0], orgName)  //NOTE hardcode
		return Instantiate(channel, peers, { chaincodeId, chaincodeVersion: 'v0', args })

	})
}


