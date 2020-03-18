const helper = require('../app/helper');
const {projectResolve} = helper;
const logger = helper.getLogger('test:orderer');
const OrdererUtil = require('../common/nodejs/builder/orderer');
const orderers = helper.newOrderers();
const node_modules = projectResolve('common/nodejs/builder/node_modules');
const OrdererManager = require('../common/nodejs/builder/orderer');
const task = async () => {
	const orderer = orderers[0];
	const ordererManager = new OrdererManager(undefined, orderer);


	switch (parseInt(process.env.taskID)) {
		case 0: {
			await ordererManager.ping();
			ordererManager.close();
			await ordererManager.reconnect(node_modules);
			await ordererManager.ping();
			ordererManager.close();
			await ordererManager.reconnect();
			await ordererManager.ping();
		}
			break;
		default: {
			const result = await OrdererUtil.ping(orderer);
			logger.debug(orderer.toString(), result);
			logger.debug(orderer._options['grpc.ssl_target_name_override'], orderer._name.split(':')[0]);
		}

	}

};

task();

