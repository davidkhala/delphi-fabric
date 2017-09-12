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

const deleteOrg = (MSPName) => {

	return api.channelUpdate(channelName, ({ update_config }) => {
		return api.deleteMSP({ MSPName, update_config })
	})

}
const addOrg = (
		orgName, MSPName, MSPID, templateMSPName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full
		, chaincodePath, chaincodeId, chaincodeVersion, args) => {

	return api.channelUpdate(channelName,
			({ update_config }) => api.cloneMSP({ MSPName, MSPID, update_config, templateMSPName, adminMSPDir, org_domain })
	).then(() => {
		const channel = helper.getChannel(channelName)
		return channel.initialize().then((config_items) => {
			logger.debug('after update', { config_items, orgs: channel.getOrganizations() })
			helper.userAction.clear()
			const keystoreDir = path.join(adminMSPDir, 'keystore')

			const signcertFile = path.join(adminMSPDir, 'signcerts', `Admin@${org_domain}-cert.pem`)
			logger.debug({ keystoreDir, signcertFile })
			return helper.userAction.create(keystoreDir, signcertFile, 'adminName', orgName, true, MSPID).then(() => {

				const tls_cacerts = api.format_tlscacert(adminMSPDir, org_domain)
				const peer = helper.newPeer({ peerPort, tls_cacerts, peer_hostName_full })

				peer.peerConfig = {
					peerEventUrl: `${GPRC_protocol}localhost:${eventHubPort}`
				}

				channel.addPeer(peer)

				return join(channel, [peer], orgName).then(() => {
					helper.setGOPATH()
					logger.debug('channel.getOrganizations()', channel.getOrganizations())
					//FIXME logger.debug("install chaincode",channel.getOrganizations())  return []
					return installChaincode([peer], chaincodeId, chaincodePath, chaincodeVersion, orgName).then(() => {
						return instantiate(channel, [peer], chaincodeId, chaincodeVersion, JSON.parse(args), orgName)

						// https://github.com/hyperledger/fabric/blob/d9c320297bd2a4eff2eb253ce84dc431ef860972/msp/mspmgrimpl.go#L98
					})
				})
				// return joinChannel(orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full)
				// TODO rethink helper.getClient()
			})
		})

	}).catch(err => {
		logger.error('addOrg', err)
		process.exit(1)
	})

}
exports.addOrg = addOrg
exports.deleteOrg = deleteOrg






