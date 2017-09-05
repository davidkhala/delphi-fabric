const helper = require('./helper')
const logger = helper.getLogger('configtxlator')

const path = require('path')
const fs = require('fs')
const agent = require('./agent2configtxlator')
const client = helper.getClient()

const helperConfig = helper.helperConfig
const { COMPANY } = helperConfig
const companyConfig = helperConfig[COMPANY]
const orgsConfig = companyConfig.orgs

const getMSPName = (orgName) => orgsConfig[orgName].MSP.name
const format_tlscacert=(adminMSPDir,org_domain)=>path.join(adminMSPDir, 'tlscacerts', `tlsca.${org_domain}-cert.pem`)
exports.format_tlscacert=format_tlscacert
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
			format_tlscacert(adminMSPDir,org_domain)).
			toString('base64')

	update_config.channel_group.groups.Application.groups[MSPName] = templateObj
	logger.debug("new MSP",templateObj)
	return update_config
}
const deleteMSP = ({ MSPName, update_config }) => {
	delete update_config.channel_group.groups.Application.groups[MSPName]
	return update_config
}

// This test case requires that the 'configtxlator' tool be running locally and on port 7059
// fixme :run configtxlator.server with nodejs child_process, program will hang and no callback or stdout
//FIXME:agent buffer has problem with promise
const fetchConfigJson = (channelName) => {
	let original_config_proto
	const channel = helper.getChannel(channelName)

	return helper.userAction.admin.orderer.select().then(() => {
//	container not found:	getChannelConfig - Failed Proposal. Error: Error: SERVICE_UNAVAILABLE
//	channel not found:	getChannelConfig - Failed Proposal. Error: Error: Invalid results returned ::NOT_FOUND

		const configEnvelope = channel.getChannelConfig()// NOTE typeof configEnvlope ==="Promise"
		return configEnvelope
	}).then(data => {
		//NOTE JSON.stringify(data ) :TypeError: Converting circular structure to JSON
		original_config_proto = data.config.toBuffer()

		// lets get the config converted into JSON, so we can edit JSON to
		// make our changes
		return agent.decode.config(original_config_proto)
	}).then(resp => {
		return {
			original_config_proto, resp, channel
		}
	})
}
const signChannelConfig = (channel, configUpdate_proto) => {

	const proto = new Buffer(configUpdate_proto, 'binary')
	const signatures = []
	const signFunc = () => {
		logger.debug('signature identity', client.getUserContext().getName())
		signatures.push(client.signChannelConfig(proto))
	}
	let promise = helper.userAction.admin.orderer.select().then(signFunc)

	for (let orgName in channel.orgs) {
		promise = promise.then(() => {
			return helper.userAction.admin.select(orgName).then(signFunc)
		})
	}

	return promise.then(() => {
		return { signatures, proto }
	})

}

const channelUpdate = (channelName, mspCB) => {
	let o_config_proto
	let channel = helper.getChannel(channelName)
	const orderer = channel.getOrderers()[0]
	return fetchConfigJson(channelName).then(({ original_config_proto, resp: { body } }) => {
		const update_config = JSON.parse(body)
		o_config_proto = original_config_proto// FIXME
		logger.debug(update_config.channel_group.groups.Application.groups)
		fs.writeFileSync(path.join(__dirname, `${channelName}-txlator.json`), body)// for debug only
		mspCB({ update_config })
		//NOTE: after delete MSP, deleted peer retry to connect to previous channel
		// PMContainerName.delphi.com       | 2017-08-24 03:02:55.815 UTC [blocksProvider] DeliverBlocks -> ERRO 2ea [delphichannel] Got error &{FORBIDDEN}
		// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [cauthdsl] func1 -> DEBU ea5 0xc420028c50 gate 1503543775814648321 evaluation fails
		// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [orderer/common/deliver] Handle -> WARN ea6 [channel: delphichannel] Received unauthorized deliver request
		// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [cauthdsl] func2 -> ERRO e9d Principal deserialization failure (MSP PMMSP is unknown)

		// PMContainerName.delphi.com       | 2017-08-24 03:03:15.823 UTC [deliveryClient] RequestBlocks -> DEBU 2ed Starting deliver with block [1] for channel delphichannel
		// PMContainerName.delphi.com       | 2017-08-24 03:03:15.824 UTC [blocksProvider] DeliverBlocks -> ERRO 2ee [delphichannel] Got error &{FORBIDDEN}
		// PMContainerName.delphi.com       | 2017-08-24 03:03:15.824 UTC [blocksProvider] DeliverBlocks -> CRIT 2ef [delphichannel] Wrong statuses threshold passed, stopping block provider

		return agent.encode.config(JSON.stringify(update_config))
	}).then(({ body }) => {
		const update_config_proto = body
		const formData = {
			channel: channel.getName(),
			original: {
				value: o_config_proto,
				options: {
					filename: 'original.proto',
					contentType: 'application/octet-stream'
				}
			},
			updated: {
				value: update_config_proto,
				options: {
					filename: 'updated.proto',
					contentType: 'application/octet-stream'
				}
			}
		}
		return agent.compute.updateFromConfigs(formData)
	}).then(({ body }) =>
			signChannelConfig(channel, body)
	).then(({ signatures, proto }) => {

		const request = {
			config: proto,
			signatures,
			name: channel.getName(),
			orderer,
			txId: client.newTransactionID()
		}

		// this will send the update request to the orderer
		return client.updateChannel(request)
	}).then((resp)=>{
		require('sleep').sleep(10)//FIXME rewrite with eventHub
		return fetchConfigJson(channelName).then(({ resp: { body } })=>{
			fs.writeFileSync(path.join(__dirname, `${channelName}-txlator.json`), body)// for debug only
			logger.info(`${channelName}-txlator.json`, "updated")
			return resp
		})
	})
}
exports.channelUpdate = channelUpdate
exports.cloneMSP = cloneMSP
exports.deleteMSP = deleteMSP
