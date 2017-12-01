const query = require('./query')
const peerUtil = require('./util/peer')
const helper = require('./helper')
const ClientUtil = require('./util/client')

const channelName = 'delphiChannel'

const logger = require('./util/logger').new('test-query')
const client = ClientUtil.new()

const queryInstantiated = () => {
	const orgName = 'PM'
	const peerIndexes = [0]
	const peers = helper.newPeers(peerIndexes, orgName)

	return helper.getOrgAdmin(orgName, client).then(() => {
		const channel = helper.prepareChannel(channelName, client, true)
		return query.chaincodes.instantiated(peers[0], channel).then((result) => {
			logger.info(result)
			return Promise.resolve(result)
		})

	})
}
const queryInstalled = ()=>{
	const orgName = 'PM'
	const peerIndexes = [0]
	const peers = helper.newPeers(peerIndexes, orgName)
	return helper.getOrgAdmin(orgName, client).then(() => {

		return query.chaincodes.installed(peers[0], client).then((result) => {
			logger.info(result)
			return Promise.resolve(result)
		})

	})
}

queryInstalled()