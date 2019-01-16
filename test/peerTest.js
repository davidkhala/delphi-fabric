const helper = require('../app/helper');
const logger = require('../common/nodejs/logger').new('test:orderer', true);
const PeerUtil = require('../common/nodejs/peer');
const peers = helper.allPeers();
const task = async () => {
	const peer = peers[1];
	const result = await PeerUtil.ping(peer);
	logger.debug(peer.toString(), result);
};
task();