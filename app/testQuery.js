const query = require('./query')
const peerUtil = require('./util/peer')
const helper = require('./helper')
const channelName = 'delphiChannel'

const logger = require('./util/logger').new('test-query')
const client = helper.getClient()

const peer = peerUtil.new({ peerPort: 9051, peer_hostName_full: 'peer0.PM.Delphi.com', host: 'localhost' })
const queryInstantiated = () => {
	return helper.getOrgAdmin('PM', client).then(() => {
		const channel = helper.prepareChannel(channelName, client, true)
		return query.chaincodes.instantiated(peer, channel).then((queryTrans) => {
			logger.info(queryTrans)
		})

	})
}

queryInstantiated()