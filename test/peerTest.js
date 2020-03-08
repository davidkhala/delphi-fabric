const helper = require('../app/helper');
const logger = helper.getLogger('test:peer');
const Peer = require('../common/nodejs/builder/peer');
const ping2Preconfig = async () => {
	const peers = helper.allPeers();
	const peer = peers[1];
	const result = await Peer.ping(peer);
	logger.debug(peer.toString(), result);
};
const composerPing = async (composerRoot = '/home/david/') => {
	const cert = `${composerRoot}fabric-dev-servers/fabric-scripts/hlfv12/composer/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.crt`;
	const peerHostName = 'peer0.org1.example.com';
	const peer = new Peer({peerPort: 7051});
	const result = await peer.ping();
	logger.debug(peer.toString(), result);
};
const task = async () => {
	switch (parseInt(process.env.taskID)) {
		case 0:
			await composerPing();
			break;
		default:
			await ping2Preconfig();
	}
};
task();


