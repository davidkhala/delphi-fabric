const invoke = require('./invoke-chaincode').invokeChaincode
const helper = require('./helper')

const invoke_fcn = ''
const invoke_args = []

const chaincodeName = 'adminChaincode'
const peerIndexes = [0, 1]
const orgName = 'BU'
const channelName = 'delphiChannel'

const peers = helper.newPeers(peerIndexes, orgName)

helper.getOrgAdmin(orgName).then(() => {

	const channel = helper.getChannel(channelName)
	return invoke(channel, peers, chaincodeName, invoke_fcn, invoke_args, orgName)

})
const _testInvokeOnNewPeer = () => {
	const orgName = 'AM'
	const GPRC_protocol = 'grpcs://' // FIXME: assume using TLS
	const { peer_hostName_full, tls_cacerts } = helper.gen_tls_cacerts(orgName, 0)
	const peerPort = 7071
	const eventHubPort = 7073
	const AMPeer = helper.newPeer({ peerPort, peer_hostName_full, tls_cacerts })
	const peers = [AMPeer]//helper.newPeers(peerIndexes, orgName)
	AMPeer.peerConfig = {
		peerEventUrl: `${GPRC_protocol}localhost:${eventHubPort}`
	}
	helper.getOrgAdmin(orgName).then(() => {

		const channel = helper.getChannel(channelName)
		return invoke(channel, peers, chaincodeName, invoke_fcn, invoke_args, orgName)

	})
}

