// This test case requires that the 'configtxlator' tool be running locally and on port 7059
// fixme :run configtxlator.server with nodejs child_process, program will hang and no callback or stdout
// TODO not ready
const path = require('path')
const fs = require('fs')
const helper = require('./helper')
const logger = helper.getLogger('configtxlator')
const client = helper.getClient()

const agent = require('./agent2configtxlator')
const channelName = 'delphiChannel'

const channel = helper.getChannel(channelName)

const testEnvelop = () => {
	let original_config_proto
	return helper.userAction.admin.orderer.select().then(admin => {
//TODO channel.getChannelConfig(): Error: Missing userContext parameter
//	container not found:	getChannelConfig - Failed Proposal. Error: Error: SERVICE_UNAVAILABLE
//	channel not found:	getChannelConfig - Failed Proposal. Error: Error: Invalid results returned ::NOT_FOUND

		return channel.getChannelConfig()// NOTE typeof configEnvelope ==="Promise"
	}).then(configEnvelope => {
		channel.loadConfigEnvelope(configEnvelope)
		logger.debug('channel msps',channel.getOrganizations())
		//NOTE JSON.stringify(data ) :TypeError: Converting circular structure to JSON
		original_config_proto = configEnvelope.config.toBuffer()

		// lets get the config converted into JSON, so we can edit JSON to
		// make our changes
		return agent.decode.config(original_config_proto)
	}).then(({ body }) => {
		const update_config = JSON.parse(body)
		logger.debug(update_config.channel_group.groups.Application.groups)
		fs.writeFileSync(path.join(__dirname, 'delphichannelator.json'), body)
		delete update_config.channel_group.groups.Application.groups.PMMSPName

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
		logger.debug({body})
		const update_config_proto = new Buffer(body, 'binary')
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
				value: update_config_proto,
				options: {
					filename: 'updated.proto',
					contentType: 'application/octet-stream'
				}
			}
		}
		return agent.compute.updateFromConfigs(formData)
	}).then(({ body }) => {
		logger.debug({body})
		logger.debug(body.toString('utf8'))
		const proto = new Buffer(body, 'binary')

		// first sign
		logger.debug('signature identity', client.getUserContext().getName())
		return {
			signatures: [client.signChannelConfig(proto)],
			proto
		}
	}).then(({ signatures, proto }) => {
		helper.userAction.clear()
		const orgName = 'BU'
		return helper.userAction.admin.select(orgName).then(
				(user) => {
					logger.debug('signature identity', client.getUserContext().getName())
					signatures.push(client.signChannelConfig(proto))
					return { signatures, proto }
				}
		)
	}).then(({ signatures, proto }) => {
		helper.userAction.clear()
		const orgName = 'PM'

		return helper.userAction.admin.select(orgName).then(
				(user) => {
					logger.debug('signature identity', client.getUserContext().getName())
					signatures.push(client.signChannelConfig(proto))
					return { signatures, proto }
				}
		)
	}).then(({ signatures, proto }) => {
		const orderer = channel.getOrderers()[0]

		const request = {
			config: proto,
			signatures,
			name: channel.getName(),
			orderer,
			txId: client.newTransactionID()
		}

		// this will send the update request to the orderer
		return client.updateChannel(request)
	}).then(results => {
		logger.debug('results', results)
		return results
	})
}


const testAPI=()=>{
	const api= require('./configtxlator')
	return api.channelUpdate(channelName)

}
testAPI().catch(err => {logger.error(err)})
// testEnvelop().catch(err => {logger.error(err)})





