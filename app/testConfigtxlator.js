//TODO This test case requires that the 'configtxlator' tool be running locally and on port 7059
const helper = require('./helper')
const logger = helper.getLogger('test-configtxlator')

const channelName = 'delphiChannel'

const join = require('./join-channel').joinChannel
const instantiate = require('./instantiate-chaincode').instantiateChaincode
const installChaincode = require('./install-chaincode').installChaincode

const api = require('./configtxlator')

const deleteOrg = (MSPName) => {

	return api.channelUpdate(channelName, ({ update_config }) => {
		return api.deleteMSP({ MSPName, update_config })
	})

}
const addOrg = (
		orgName, MSPName, MSPID, templateMSPName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full
		, chaincodePath, chaincodeId, chaincodeVersion, args) => {
	const channel = helper.getChannel(channelName)
	return api.channelUpdate(channelName,
			({ update_config }) => {
				if (channel.getOrganizations().find((entry) => {
							return entry.id === MSPID
						})) {
					logger.warn(MSPID, 'msp exist in channel', channel.getName())
					process.exit(0)
				} else {

					return api.cloneMSP({ MSPName, MSPID, update_config, templateMSPName, adminMSPDir, org_domain })
				}
			}
	).then(() => {
		return channel.initialize().then(() => {
			logger.debug('after update', channel.getOrganizations())
			helper.userAction.clear()
			const keystoreDir = path.join(adminMSPDir, 'keystore')

			const signcertFile = path.join(adminMSPDir, 'signcerts', `Admin@${org_domain}-cert.pem`)
			logger.debug({ keystoreDir, signcertFile })
			return helper.userAction.mspCreate(keystoreDir, signcertFile, 'adminName', orgName, MSPID, true).then(() => {

				const tls_cacerts = api.format_tlscacert(adminMSPDir, org_domain)
				const peer = helper.newPeer({ peerPort, tls_cacerts, peer_hostName_full })

				peer.peerConfig = {
					eventHubPort
				}

				channel.addPeer(peer)

				return join(channel, [peer], orgName).then(() => {
					helper.setGOPATH()
					return installChaincode([peer], chaincodeId, chaincodePath, chaincodeVersion, orgName).then(() => {
						return instantiate(channel, [peer], chaincodeId, chaincodeVersion, JSON.parse(args), orgName)

					})
				})
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






