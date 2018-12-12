const helper = require('../app/helper');
const logger = require('../common/nodejs/logger').new('test:orderer', true);
const OrdererUtil = require('../common/nodejs/orderer');
const orderers = helper.newOrderers();
const task = async () => {
	const orderer = orderers[0];

	const result = await OrdererUtil.connect(orderer);
	logger.debug(result);
};
task();

