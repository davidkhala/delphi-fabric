const Peer = require('fabric-client/lib/Peer')
const fs = require('fs-extra')
exports.new = ({ peerPort, tls_cacerts, pem, peer_hostName_full, host }) => {
	const Host = host ? host : 'localhost'
	const peerUrlTLS = `grpcs://${Host}:${peerPort}`
	if (pem) {
		//tls enabled
		const peer = new Peer(peerUrlTLS, {
			pem,
			'ssl-target-name-override': peer_hostName_full
		})
		peer.pem = pem
		return peer
	}
	else if (tls_cacerts) {
		//tls enabled
		const pem = fs.readFileSync(tls_cacerts).toString()
		const peer = new Peer(peerUrlTLS, {
			pem,
			'ssl-target-name-override': peer_hostName_full
		})
		peer.pem = pem
		return peer
	} else {
		//tls disaled
		const peerUrl = `grpc://${Host}:${peerPort}`
		return new Peer(peerUrl)
	}
}
