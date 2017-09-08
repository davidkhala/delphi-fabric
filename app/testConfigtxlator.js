//NOTE This test case requires that the 'configtxlator' tool be running locally and on port 7059
const helper = require('./helper')
const logger = helper.getLogger('test-configtxlator')

const channelName = 'delphiChannel'
const GPRC_protocol = 'grpcs://' // FIXME: assume using TLS

const join = require('./join-channel').joinChannel
const instantiate = require('./instantiate-chaincode').instantiateChaincode
const installChaincode = require('./install-chaincode').installChaincode
const api = require('./configtxlator')
//TODO not ready
exports.installChaincode = (orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full
		, chaincodePath, chaincodeId, chaincodeVersion, args) => {
	helper.setGOPATH()

	const tls_cacerts = api.format_tlscacert(adminMSPDir, org_domain)

	const peer = helper.newPeer({ peerPort, tls_cacerts, peer_hostName_full })

	peer.peerConfig = {
		peerEventUrl: `${GPRC_protocol}localhost:${eventHubPort}`
	}
	const channel=helper.getChannel(channelName)
	channel.addPeer(peer)
	logger.debug(channel.getOrganizations())
	return installChaincode([peer], chaincodeId, chaincodePath, chaincodeVersion, orgName).then(() => {
		return instantiate(channelName, [peer], chaincodeId, chaincodeVersion, JSON.parse(args), orgName)

		// https://github.com/hyperledger/fabric/blob/d9c320297bd2a4eff2eb253ce84dc431ef860972/msp/mspmgrimpl.go#L98
	})
}
const joinChannel = (orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full) => {
	logger.debug('joinChannel', { orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full })
	const channel = helper.getChannel(channelName)

	const tls_cacerts = api.format_tlscacert(adminMSPDir, org_domain)
	const peer = helper.newPeer({ peerPort, tls_cacerts, peer_hostName_full })

	peer.peerConfig = {
		peerEventUrl: `${GPRC_protocol}localhost:${eventHubPort}`
	}
	channel.addPeer(peer)

	return join(channelName, [peer], orgName)
}

const deleteOrg = (MSPName) => {

	return api.channelUpdate(channelName, ({ update_config }) => {
		return api.deleteMSP({ MSPName, update_config })
	})

}
const addOrg = (
		orgName, MSPName, MSPID, templateMSPName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full) => {
	return api.channelUpdate(channelName,
			({ update_config }) => api.cloneMSP({ MSPName, MSPID, update_config, templateMSPName, adminMSPDir, org_domain })
	).then(() => {
		return helper.getChannel(channelName).initialize().then(() => {
			helper.userAction.clear()
			const keystoreDir = path.join(adminMSPDir, 'keystore')

			const signcertFile = path.join(adminMSPDir, 'signcerts', `Admin@${org_domain}-cert.pem`)
			logger.debug({ keystoreDir, signcertFile })
			return helper.userAction.create(keystoreDir, signcertFile, 'adminName', orgName, true, MSPID).then(() => {

				return helper.getChannel(channelName).getChannelConfig().then(channelConfig => {
					return joinChannel(orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full)
				})
			})
		})

	}).then(resp => {
		logger.info('addOrg success', resp)
		return Promise.resolve(resp)
	}).catch(err => {
		logger.error('addOrg', err)
		return Promise.reject(err)
	})

}
exports.addOrg = addOrg
exports.deleteOrg = deleteOrg






