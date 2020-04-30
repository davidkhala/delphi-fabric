const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:peer');
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
