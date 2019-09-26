const fs = require('fs');
const PeerUtil = require('khala-fabric-sdk-node/peer');
const {helper: {homeResolve}} = require('khala-fabric-sdk-node').nodeUtil;
const ping = async () => {
	const host = 'peer0.astri.org';
	const cert = homeResolve('ca.crt');
	const pem = fs.readFileSync(cert).toString();
	const peerUrl = `grpcs://${host}:7051`;
	const peerOpts = {
		'ssl-target-name-override': host,
		pem
	};
	const peer = new PeerUtil.Peer(peerUrl, peerOpts);
	await PeerUtil.ping(peer);
};
const ping2 = async () => {
	const host = 'peer1.astri.org';
	const keyFile = homeResolve('clientKey');
	const certFile = homeResolve('clientCert');
	const permFile = homeResolve('ca.crt');
	const pem = fs.readFileSync(permFile).toString();
	const clientKey = fs.readFileSync(keyFile).toString();
	const clientCert = fs.readFileSync(certFile).toString();
	const peerUrl = `grpcs://${host}:7051`;
	// Error: PEM encoded certificate is required.
	const peerOpts = {
		clientKey,
		clientCert,
		pem
	};
	const peer = new PeerUtil.Peer(peerUrl, peerOpts);
	await PeerUtil.ping(peer);
};
ping();
ping2();
