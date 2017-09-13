const invoke = require('./invoke-chaincode').invokeChaincode
const helper = require('./helper')

const invoke_fcn = ''
const invoke_args = []

const chaincodeName = 'delphiChaincode'
const peerIndexes = [0]
const orgName = 'AM'
const channelName = 'delphiChannel'

const { peer_hostName_full, tls_cacerts } = helper.gen_tls_cacerts(orgName, 0)
const peerPort = 7071
const eventHubPort = 7073
const AMPeer = helper.newPeer({ peerPort, peer_hostName_full, tls_cacerts })
const peers = [AMPeer]//helper.newPeers(peerIndexes, orgName)

const GPRC_protocol = 'grpcs://' // FIXME: assume using TLS
AMPeer.peerConfig = {
	peerEventUrl: `${GPRC_protocol}localhost:${eventHubPort}`
}
//todo to test
helper.getOrgAdmin(orgName).then(() => {

	const channel = helper.getChannel(channelName)
	return invoke(channel, peers, chaincodeName, invoke_fcn, invoke_args, orgName)

})

