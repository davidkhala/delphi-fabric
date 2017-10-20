exports.chain = (peer, channel) => channel.queryInfo(peer)
exports.chaincodes = {
	installed: (peer, client) => client.queryInstalledChaincodes(peer),
	instantiated: (peer, channel, orgName) => channel.queryInstantiatedChaincodes(peer)
}
exports.block = {
	hash: (peer, channel, hash) => channel.queryBlockByHash(Buffer.from(hash), peer),
	height: (peer, channel, blockNumber) => channel.queryBlock(parseInt(blockNumber), peer)
}
exports.channel = {
	joined: (peer, client) => client.queryChannels(peer)
}
exports.tx = { query: (peer, channel, txId) => channel.queryTransaction(txId, peer) }
