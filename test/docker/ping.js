const fs = require('fs');
const PeerUtil = require('khala-fabric-sdk-node/peer');
const {homeResolve} = require('khala-fabric-sdk-node/helper').nodeUtil.helper();
const ping = async () => {
	const host = 'peer1.icdd';
	const cert = homeResolve('ca.crt');
	const pem = fs.readFileSync(cert).toString();
	const peerUrl = `grpcs://${host}:7051`;
	const peerOpts = {
		'ssl-target-name-override': host,
		pem
	};
	const peer = new PeerUtil.Peer(peerUrl, peerOpts);
	await PeerUtil.ping(peer);
	await PeerUtil.ping(peer); // to test gRpcs lock
};
ping();