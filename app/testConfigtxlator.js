//NOTE This test case requires that the 'configtxlator' tool be running locally and on port 7059
const helper = require('./helper')
const logger = helper.getLogger('test-configtxlator')

const channelName = 'delphiChannel'
const COMPANY = 'delphi'
const companyConfig = helper.helperConfig[COMPANY]
const eventHelper = require('./eventHubHelper')
const Peer = require('fabric-client/lib/Peer')


const api = require('./configtxlator')
const GPRC_protocol = 'grpcs://' // FIXME: assume using TLS
const joinChannel = (
		orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full) => {
	logger.debug("joinChannel",{orgName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full})
	const client = helper.getClient()
	const channel = helper.getChannel(channelName)

	return helper.getOrgAdmin(orgName).then(() => channel.getGenesisBlock({ txId: client.newTransactionID() })).
			then(genesis_block => {
				const tls_cacerts = api.format_tlscacert(adminMSPDir, org_domain)
				const peerUrl = `${GPRC_protocol}localhost:${peerPort}`
				const peer = new Peer(peerUrl, {
					pem: fs.readFileSync(tls_cacerts).toString(),
					'ssl-target-name-override': peer_hostName_full
				})

				channel.addPeer(peer)
				const request = {
					targets: [peer],
					txId: client.newTransactionID(),
					block: genesis_block
				}

				const { eventWaitTime } = channel
				const eventHubUrl = `${GPRC_protocol}localhost:${eventHubPort}`
				const eventHub = client.newEventHub()// NOTE newEventHub binds to clientContext
				eventHub.setPeerAddr(eventHubUrl, {
					pem: fs.readFileSync(tls_cacerts).toString(),
					'ssl-target-name-override': peer_hostName_full
				})
				eventHub.connect()
				const txPromise = new Promise((resolve, reject) => {

					const timer_id = setTimeout(() => {
						eventHelper.unRegisterAllEvents(eventHub)
						eventHub.disconnect()
						reject()
					}, eventWaitTime)
					eventHub.registerBlockEvent((block) => {
						clearTimeout(timer_id)
						logger.debug('new block event arrived', block)
						// in real-world situations, a peer may have more than one channels so
						// we must check that this block came from the channel we asked the peer to join
						if (block.data.data.length === 1) {
							// Config block must only contain one transaction
							if (block.data.data[0].payload.header.channel_header.channel_id
									=== channel.getName()) {
								eventHelper.unRegisterAllEvents(eventHub)
								return resolve(block)
							}
						}
						//	TODO otherwise: wait and keep eventhub connected
					}, err => {
						logger.error('eventhub error', err)
					})
				})

				return channel.joinChannel(request).then(() => txPromise).then((block) => {
					eventHub.disconnect()
					return block
				})
			})
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
		logger.info('success', resp)

	}).catch(err => {
		logger.error(err)

	})

}
exports.addOrg = addOrg
exports.deleteOrg = deleteOrg






