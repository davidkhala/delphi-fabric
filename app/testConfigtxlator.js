// This test case requires that the 'configtxlator' tool be running locally and on port 7059
// fixme :run configtxlator.server with nodejs, program will hang and no callback or stdout
// TODO not ready
const path = require('path')
const fs = require('fs')
const helper = require('./helper')
const logger = helper.getLogger('configtxlator')
const client = helper.getClient()

const mychannelator_json = fs.readFileSync(
		path.join(__dirname, './delphichannelator.json'))
const agent = require('./agent2configtxlator')
const channelName = 'delphiChannel'

const channel = helper.getChannel(channelName)
const testEnvelop = () => {
	// require('./testChannel')
	let original_config_proto
	return helper.userAction.admin.orderer.select().then(admin => {
//TODO channel.getChannelConfig(): Error: Missing userContext parameter
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
	}).then((resp) => {
		const update_config = JSON.parse(resp.text)
		logger.debug(update_config.channel_group.groups.Application.groups)
		delete update_config.channel_group.groups.Application.groups.PMMSPName

		return agent.encode.config(JSON.stringify(update_config))
	}).then((resp) => {
		const update_config_proto = resp.body
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
		const proto = new Buffer(body, 'binary')


		// first sign
		logger.debug('signature identity',client.getUserContext())
		return {
			proto,
			signatures: [client.signChannelConfig(proto)]
		}
	}).then(({ proto, signatures }) => {
		client._userContext = null
		client.setCryptoSuite(null)
		const keystoreDir = '/home/david/Documents/delphi-fabric/config/crypto-config/peerOrganizations/bu.delphi.com/users/Admin@bu.delphi.com/msp/keystore'
		const signcertFile = '/home/david/Documents/delphi-fabric/config/crypto-config/peerOrganizations/bu.delphi.com/users/Admin@bu.delphi.com/msp/signcerts/Admin@bu.delphi.com-cert.pem'
		const orgName = 'BU'
		const username = 'adminName'
		return helper.userAction.create(keystoreDir, signcertFile, username, orgName).then(
				(user) => {
					logger.debug('signature identity',client.getUserContext().getName())
					signatures.push(client.signChannelConfig(proto))
					return { proto, signatures }
				}
		)
	}).then(({ signatures, proto }) => {
		client._userContext = null
		client.setCryptoSuite(null)
		const keystoreDir = '/home/david/Documents/delphi-fabric/config/crypto-config/peerOrganizations/pm.delphi.com/users/Admin@pm.delphi.com/msp/keystore'
		const signcertFile = '/home/david/Documents/delphi-fabric/config/crypto-config/peerOrganizations/pm.delphi.com/users/Admin@pm.delphi.com/msp/signcerts/Admin@pm.delphi.com-cert.pem'
		const orgName = 'PM'
		const username = 'adminName'

		return helper.userAction.create(keystoreDir, signcertFile, username, orgName).then(
				(user) => {
					logger.debug('signature identity',client.getUserContext().getName())
					signatures.push(client.signChannelConfig(proto))
					return { signatures, proto }
				}
		)
	}).then(({ signatures, proto }) => {
		const orderer = channel.getOrderers()[0]

		const request = {
			config: proto,
			signatures: signatures,
			name: channel.getName(),
			orderer,
			txId: client.newTransactionID()
		};

		// this will send the update request to the orderer
		return client.updateChannel(request);
	})
}

testEnvelop().catch(err => {logger.error(err)})
//TODO leave it here
const createChannel = () => {

	let config_proto
	helper.getOrgAdmin('BU').then((admin) => {
		logger.debug({ admin })
		return agent.encode.configUpdate(mychannelator_json)
	}).then(resp => {
		config_proto = resp.body
		const signature = client.signChannelConfig(config_proto)
		client._userContext = null
		return { admin: helper.getOrgAdmin('PM'), signatures: [signature] }
	}).then(({ admin, signatures }) => {
		const signature = client.signChannelConfig(config_proto)
		signatures.push(signature)

		const orderer = helper.getChannel(channelName).getOrderers()[0]
		const request = {
			config: config_proto,
			signatures,
			name: channelName,
			orderer,
			txId: client.newTransactionID()
		}

		// this will send the create request to the orderer
		return client.updateChannel(request)

	})
}

// sign the config
// const signature = client.signChannelConfig(config_proto);
// // collect signature
// signatures.push(signature);
//
// // make sure we do not reuse the user
// client._userContext = null;
//
// return testUtil.getSubmitter(client, t, true /*get the org admin*/, 'org2');



