const helper = require('../app/helper');
const logger = helper.getLogger('test:peer');
const PeerUtil = require('../common/nodejs/peer');
const fs = require('fs');
const ping2Preconfig = async () => {
	const peers = helper.allPeers();
	const peer = peers[1];
	const result = await PeerUtil.ping(peer);
	logger.debug(peer.toString(), result);
};
const composerPing = async (composerRoot = '/home/david/') => {
	const cert = `${composerRoot}fabric-dev-servers/fabric-scripts/hlfv12/composer/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.crt`;
	const peerHostName = 'peer0.org1.example.com';
	const peer = PeerUtil.new({peerPort: 7051});
	const result = await PeerUtil.ping(peer);
	logger.debug(peer.toString(), result);
};
const pingMCC = async () => {
	const host = 'peer0.BC';
	const cert = '/home/davidliu/crypto-config/peerOrganizations/BC/peers/peer0.BC/tls/ca.crt';
	const pem = fs.readFileSync(cert).toString();
	const peerUrl = 'grpcs://localhost:8051';
	const peerOpts = {
		'ssl-target-name-override': host,
		pem
	};
	const peer = new PeerUtil.Peer(peerUrl, peerOpts);
	await PeerUtil.ping(peer);
};
// ping2Preconfig();
// composerPing();
pingMCC();
