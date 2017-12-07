// NOTE Invoke action cannot be performed on peer without chaincode installed(no matter whether chaincode has been instantiated on this peer): Error: cannot retrieve package for chaincode adminChaincode/v0, error open /var/hyperledger/production/chaincodes/adminChaincode.v0: no such file or directory

const { invoke } = require('./invoke-chaincode')
const { reducer } = require('./util/chaincode').reducer
const helper = require('./helper')

const logger = require('./util/logger').new('testInvoke')
const chaincodeId = 'adminChaincode'
const fcn = 'read'
const args = ['project', 'Blockchain Hyperledger Demonstration']
const peerIndexes = [0]
const orgName = 'PM'
const channelName = 'delphiChannel'
const ClientUtil = require('./util/client')

const peers = helper.newPeers(peerIndexes, orgName)
const client = ClientUtil.new()
helper.getOrgAdmin(orgName, client).then(() => {
	const channel = helper.prepareChannel(channelName, client, true)
	return invoke(channel, peers, { chaincodeId, fcn, args })
}).then(reducer).then(_ => logger.info(_))
const _testInvokeOnNewPeer = () => {
	const orgName = 'AM'
	const { peer_hostName_full, tls_cacerts } = helper.gen_tls_cacerts(orgName, 0)
	const peerPort = 7071
	const eventHubPort = 7073
	const AMPeer = helper.newPeer({ peerPort, peer_hostName_full, tls_cacerts })
	const peers = [AMPeer]//helper.newPeers(peerIndexes, orgName)
	AMPeer.peerConfig = {
		eventHubPort
	}
	helper.getOrgAdmin(orgName).then(() => {

		const channel = helper.prepareChannel(channelName)
		return invoke(channel, peers, { chaincodeId, fcn, args })

	})
}

