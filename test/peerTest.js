const helper = require('../app/helper');
const logger = helper.getLogger('test:peer');
const Peer = require('../common/nodejs/admin/peer');
const task = async (taskId) => {
	switch (taskId) {
		default: {
			const peers = helper.allPeers();
			const peer = peers[1];
			const result = await Peer.ping(peer);
			logger.debug(peer.toString(), result);
		}
	}
};

task(process.env.taskID);
