const helper = require('../app/helper');
const logger = require('../common/nodejs/logger').new('test:orderer', true);
const OrdererUtil = require('../common/nodejs/orderer');
const orderers = helper.newOrderers();
const task = async () => {
	const orderer = orderers[1];

	const result = await OrdererUtil.ping(orderer);
	logger.debug(orderer.toString(), result);
};
task();

