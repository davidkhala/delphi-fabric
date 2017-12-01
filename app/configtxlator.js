const helper = require('./helper')
const logger = require('./util/logger').new('configtxlator')

const path = require('path')
const fs = require('fs')
const agent = require('./util/agent2configtxlator')
const ClientUtil = require('./util/client')
const client = ClientUtil.new()

const format_tlscacert = (adminMSPDir, org_domain) => path.join(adminMSPDir, 'tlscacerts',
		`tlsca.${org_domain}-cert.pem`)
exports.format_tlscacert = format_tlscacert
const cloneMSP = ({ MSPName, MSPID, update_config, templateMSPName, adminMSPDir, org_domain }) => {
// Note templateJson might differs with different channel profile, take care
	const templateJson = JSON.stringify(update_config.channel_group.groups.Application.groups[templateMSPName])
	const templateObj = JSON.parse(templateJson)// copy via json convert
	templateObj.policies.Admins.policy.value.identities[0].principal.msp_identifier = MSPID
	templateObj.policies.Readers.policy.value.identities[0].principal.msp_identifier = MSPID
	templateObj.policies.Writers.policy.value.identities[0].principal.msp_identifier = MSPID
	templateObj.values.MSP.value.config.name = MSPID
	templateObj.values.MSP.value.config.admins[0] = fs.readFileSync(
			path.join(adminMSPDir, 'admincerts', `Admin@${org_domain}-cert.pem`)).toString('base64')
	templateObj.values.MSP.value.config.root_certs[0] = fs.readFileSync(
			path.join(adminMSPDir, 'cacerts', `ca.${org_domain}-cert.pem`)).toString('base64')
	templateObj.values.MSP.value.config.tls_root_certs[0] = fs.readFileSync(
			format_tlscacert(adminMSPDir, org_domain)).
			toString('base64')

	update_config.channel_group.groups.Application.groups[MSPName] = templateObj
	logger.debug('new MSP', templateObj)
	return update_config
}
const deleteMSP = ({ MSPName, update_config }) => {
	delete update_config.channel_group.groups.Application.groups[MSPName]
	return update_config
}

// This test case requires that the 'configtxlator' tool be running locally and on port 7059
// fixme :run configtxlator.server with nodejs child_process, program will hang and no callback or stdout
const signChannelConfig = (channel, configUpdate_proto) => {

	const proto = new Buffer(configUpdate_proto, 'binary')
	const signatures = []
	const signFunc = () => {
		logger.debug('signature identity', client.getUserContext().getName())
		signatures.push(client.signChannelConfig(proto))
	}
	let promise = helper.userAction.admin.orderer.select(client).then(signFunc)

	for (let orgName in channel.orgs) {
		promise = promise.then(() => {
			return helper.userAction.admin.select(orgName,client).then(signFunc)
		})
	}

	return promise.then(() => {
		return { signatures, proto }
	})

}

const channelUpdate = (channelName, mspCB) => {
	const channel = helper.prepareChannel(channelName, client, true)
	const orderer = channel.getOrderers()[0]

	return helper.userAction.admin.orderer.select(client).then(() => {
//	container not found:	getChannelConfig - Failed Proposal. Error: Error: SERVICE_UNAVAILABLE
//	channel not found:	getChannelConfig - Failed Proposal. Error: Error: Invalid results returned ::NOT_FOUND

		// NOTE typeof channel.getChannelConfig() ==="Promise"
		return channel.getChannelConfig().then(configEnvelope => {
			//NOTE JSON.stringify(data ) :TypeError: Converting circular structure to JSON
			const original_config_proto = configEnvelope.config.toBuffer()
			channel.loadConfigEnvelope(configEnvelope)

			// lets get the config converted into JSON, so we can edit JSON to
			// make our changes
			return agent.decode.config(original_config_proto).then(({ body }) => {
				const update_config = JSON.parse(body)
				logger.debug(update_config.channel_group.groups.Application.groups)
				fs.writeFileSync(path.join(__dirname, `${channelName}-txlator.json`), body)// for debug only
				return Promise.resolve(mspCB({ update_config })).then(() => agent.encode.config(JSON.stringify(update_config)))
				//NOTE: after delete MSP, deleted peer retry to connect to previous channel
				// PMContainerName.delphi.com       | 2017-08-24 03:02:55.815 UTC [blocksProvider] DeliverBlocks -> ERRO 2ea [delphichannel] Got error &{FORBIDDEN}
				// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [cauthdsl] func1 -> DEBU ea5 0xc420028c50 gate 1503543775814648321 evaluation fails
				// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [orderer/common/deliver] Handle -> WARN ea6 [channel: delphichannel] Received unauthorized deliver request
				// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [cauthdsl] func2 -> ERRO e9d Principal deserialization failure (MSP PMMSP is unknown)

				// PMContainerName.delphi.com       | 2017-08-24 03:03:15.823 UTC [deliveryClient] RequestBlocks -> DEBU 2ed Starting deliver with block [1] for channel delphichannel
				// PMContainerName.delphi.com       | 2017-08-24 03:03:15.824 UTC [blocksProvider] DeliverBlocks -> ERRO 2ee [delphichannel] Got error &{FORBIDDEN}
				// PMContainerName.delphi.com       | 2017-08-24 03:03:15.824 UTC [blocksProvider] DeliverBlocks -> CRIT 2ef [delphichannel] Wrong statuses threshold passed, stopping block provider
			}).then(({ body }) => {
				const formData = {
					channel: channel.getName(),
					original: {
						value: original_config_proto,
						options: {
							filename: 'original.proto',
							contentType: 'application/octet-stream'
						}
					},
					updated: {
						value: body,
						options: {
							filename: 'updated.proto',
							contentType: 'application/octet-stream'
						}
					}
				}
				return agent.compute.updateFromConfigs(formData)
			}).then(({ body }) => signChannelConfig(channel, body).then(({ signatures, proto }) => {

						const request = {
							config: proto,
							signatures,
							name: channel.getName(),
							orderer,
							txId: client.newTransactionID()
						}

						return client.updateChannel(request)
					})
			)
		})
	}).then(resp => {
		logger.debug('[old]channel.getOrg', channel.getOrganizations())
		const orgs_old = channel.getOrganizations()
		//NOTE evenHub method not good for addOrg because event is signed by old org: event message must be properly signed by an identity from the same organization as the peer: [failed deserializing event creator: [Expected MSP ID AMMSP, received PMMSP]
		const loopGetChannel = () => {
			return channel.initialize().then(() => {
				const orgs_new = channel.getOrganizations()
				//TODO to generify update checking logic
				if (orgs_new.length === orgs_old.length) {
					logger.warn('loopGetChannel', 'try...')
					return loopGetChannel()
				}
				return Promise.resolve()
			})
		}
		return loopGetChannel().then(() => {
			logger.debug('[new]channel.getOrg', channel.getOrganizations())
			return resp
		})
	})
}
exports.channelUpdate = channelUpdate
exports.cloneMSP = cloneMSP
exports.deleteMSP = deleteMSP
