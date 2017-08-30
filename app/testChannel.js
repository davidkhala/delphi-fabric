// TODO not found
const channel = { create: require('./create-channel').createChannel, join: require('./join-channel').joinChannel }

const helper = require('./helper')
const logger = helper.getLogger('testChannel')
const channelName = 'delphiChannel'
const channelConfigFile = '/home/david/Documents/delphi-fabric/config/configtx/delphi.channel'
const joinAllfcn = () => {
	require('sleep').sleep(1)//FIXME rewrite with eventHub
	return channel.join(channelName, [0, 1], 'BU').then(() => {
		return channel.join(channelName, [0], 'PM')
	}).catch(joinErr => {
		logger.error({ joinErr })
	})
}
channel.create(channelName, channelConfigFile, 'BU').then(() => {
	return joinAllfcn()
}).catch(err => {
	logger.error(err)
	if (err.toString().includes('Error: BAD_REQUEST')) {
		//existing swallow
		//TODO partial join
		return joinAllfcn()
	}

})


