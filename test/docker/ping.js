const Peer = require('khala-fabric-sdk-node-builder/peer');
const {helper: {homeResolve}} = require('khala-fabric-sdk-node');
const ping = async () => {
	const host = 'peer0.astri.org';
	const cert = homeResolve('ca.crt');
	const peer = new Peer({peerPort: 7051, host, cert});
	await peer.ping();
};
const ping2 = async () => {
	const host = 'peer1.astri.org';
	const clientKey = homeResolve('clientKey');
	const clientCert = homeResolve('clientCert');
	const cert = homeResolve('ca.crt');
	// Error: PEM encoded certificate is required.

	const peer = new Peer({peerPort: 7051, host, cert, clientCert, clientKey});
	await peer.ping();
};
ping();
ping2();
