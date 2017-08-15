const helper = require('./helper.js')
const logger = helper.getLogger('Query')

const getBlockByNumber = function(containerName, channelName, blockNumber, org) {
	const target = helper.newPeerByContainer(containerName)
	const channel = helper.getChannel(channelName)

	return helper.getOrgAdmin(org).then((member) => {
		return channel.queryBlock(parseInt(blockNumber), target)
	})
}
const getTransactionByID = function(peer, txId, org) {
	const target = helper.newPeerByContainer(containerName)
	const channel = helper.getChannel(channelName)

	return helper.getOrgAdmin(org).then((member) => {
		return channel.queryTransaction(txId, target)
	})
}
const getBlockByHash = (containerName, channelName, hash, org) => {
	const target = helper.newPeerByContainer(containerName)
	const channel = helper.getChannel(channelName)

	return helper.getOrgAdmin(org).then((member) => {
		return channel.queryBlockByHash(Buffer.from(hash), target)
	})
}
const getChainInfo = function(containerName, channelName, org) {
	const target = helper.newPeerByContainer(containerName)
	const channel = helper.getChannel(channelName)
	return helper.getOrgAdmin(org).then((member) => {
		return channel.queryInfo(target)
	})
}
//getInstalledChaincodes
const getInstalledChaincodes = function(containerName, channelName, type, username, org) {
	const target = helper.newPeerByContainer(containerName)
	const channel = helper.getChannel(channelName)
	const client = helper.getClient()

	return helper.getOrgAdmin(org).then((member) => {
		if (type === 'installed') {
			return client.queryInstalledChaincodes(target)
		} else {
			return channel.queryInstantiatedChaincodes(target)
		}
	})
}
const getChannels = function(containerName, org) {
	const target = helper.newPeerByContainer(containerName)
	const client = helper.getClient()
	return helper.getOrgAdmin(username, org).then((member) => {
		//channel.setPrimaryPeer(targets[0]);
		return client.queryChannels(target)
	})
}

exports.getBlockByNumber = getBlockByNumber
exports.getTransactionByID = getTransactionByID
exports.getBlockByHash = getBlockByHash
exports.getChainInfo = getChainInfo
exports.getInstalledChaincodes = getInstalledChaincodes
exports.getChannels = getChannels
