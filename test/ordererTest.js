const helper = require('../app/helper');
const logger = require('khala-logger').consoleLogger('test:orderer');
const OrdererUtil = require('../common/nodejs/admin/orderer');
const orderers = helper.newOrderers();
const task = async (taskID) => {
	const orderer = orderers[1];

	switch (taskID) {
		default: {
			const result = await OrdererUtil.ping(orderer);
			logger.debug(orderer.toString(), result);
		}
	}

};
task(process.env.taskID);



