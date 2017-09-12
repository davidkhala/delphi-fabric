const createChannel = require('./create-channel').createChannel
const joinChannel = require('./join-channel').joinChannel

const helper = require('./helper')
const logger = helper.getLogger('testChannel')
const channelName = 'delphiChannel'
const channelConfigFile = '/home/david/Documents/delphi-fabric/config/configtx/delphi.channel'
const joinAllfcn = () => {

	const orgName = 'BU'
	const peers = [
		helper.preparePeer(orgName, 0,
				{ 'portMap': [{ 'host': 7051, 'container': 7051 }, { 'host': 7053, 'container': 7053 }] }),
		helper.preparePeer(orgName, 1,
				{ 'portMap': [{ 'host': 7061, 'container': 7051 }, { 'host': 7063, 'container': 7053 }] })
	]

	const channel = helper.getChannel(channelName)
	return joinChannel(channel, peers, orgName).then(() => {

		const orgName = 'PM'
		const peers = [
			helper.preparePeer(orgName, 0, {
				'portMap': [
					{ 'host': 9051, 'container': 7051 },
					{ 'host': 9053, 'container': 7053 }
				]
			})
		]
		return joinChannel(channel, peers, orgName)
	})
}
//E0905 10:07:20.462272826    7262 ssl_transport_security.c:947] Handshake failed with fatal error SSL_ERROR_SSL: error:14090086:SSL routines:ssl3_get_server_certificate:certificate verify failed.

createChannel(channelName, channelConfigFile, ['BU', 'PM']).then(() => {
	return joinAllfcn()
}).catch(err => {
	logger.error(err)
	if (err.toString().includes('Error: BAD_REQUEST')) {
		//existing swallow
		return joinAllfcn()
	}

}).then(() => {
	logger.info('finished')
	process.exit(0)
}).catch((err) => {
	logger.error('joinChannel Error', err)
})


