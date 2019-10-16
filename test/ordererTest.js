const helper = require('../app/helper');
const logger = helper.getLogger('test:orderer');
const OrdererUtil = require('../common/nodejs/orderer');
const orderers = helper.newOrderers();
const task = async () => {
	const orderer = orderers[1];

	const result = await OrdererUtil.ping(orderer);
	logger.debug(orderer.toString(), result);

	logger.debug(orderer._options['grpc.ssl_target_name_override'], orderer._name.split(':')[0]);
};

task();

