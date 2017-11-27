exports.chain = (peer, channel) => channel.queryInfo(peer)
exports.chaincodes = {
	installed: (peer, client) => client.queryInstalledChaincodes(peer),// FIXME:peer or [peer]
	instantiated: (peer, channel) => channel.queryInstantiatedChaincodes(peer)
}
exports.block = {
	//NOTE blockchain is a summary of all chaincode
	hash: (peer, channel, hashBuffer) => channel.queryBlockByHash(hashBuffer, peer),
	height: (peer, channel, blockNumber) => channel.queryBlock(parseInt(blockNumber), peer)
}
exports.channel = {
	joined: (peer, client) => client.queryChannels(peer) //FIXME peer or [peer]bug design here:Failed Channels Query. Error: Error: Too many results returned	at /fabric-client/lib/Client.js:786:29

}
exports.tx = (peer, channel, txId) => channel.queryTransaction(txId, peer)
