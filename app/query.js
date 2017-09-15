const helper = require('./helper.js')

const getBlockByNumber = (peer, channel, blockNumber, orgName) => helper.getOrgAdmin(orgName).then(() => {
	return channel.queryBlock(parseInt(blockNumber), peer)
})

const getTransactionByID = (peer, channel, txId, orgName) => helper.getOrgAdmin(orgName).then(() => {
	return channel.queryTransaction(txId, peer)
})
const getBlockByHash = (peer, channel, hash, orgName) => helper.getOrgAdmin(orgName).then(() => {
	return channel.queryBlockByHash(Buffer.from(hash), peer)
})
const getChainInfo = (peer, channel, orgName) => helper.getOrgAdmin(orgName).then(() => {
	return channel.queryInfo(peer)
})
const getInstalled = (peer, client, orgName) => helper.getOrgAdmin(orgName).then(() => {
	return client.queryInstalledChaincodes(peer)
})
const getInstantiated = (peer, channel, orgName) =>
		helper.getOrgAdmin(orgName).then(() => {
			return channel.queryInstantiatedChaincodes(peer)
		})
const getChannels = (peer, client, orgName) => helper.getOrgAdmin(orgName).then(() => {
	//channel.setPrimaryPeer(targets[0]);
	return client.queryChannels(peer)
})

exports.getBlockByNumber = getBlockByNumber
exports.getTransactionByID = getTransactionByID
exports.getBlockByHash = getBlockByHash
exports.getChainInfo = getChainInfo
exports.chaincodes = { getInstalled, getInstantiated }
exports.getChannels = getChannels
