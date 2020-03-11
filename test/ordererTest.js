const helper = require('../app/helper');
const logger = helper.getLogger('test:orderer');
const OrdererUtil = require('../common/nodejs/builder/orderer');
const orderers = helper.newOrderers();
const node_modules = '/home/davidliu/Documents/delphi-fabric/common/nodejs/builder/node_modules';
const task = async () => {
	const orderer = orderers[1];

	switch (parseInt(process.env.taskID)) {
		case 0:
			OrdererUtil.createClient(orderer,node_modules); // TODO WIP
			break;
		default: {
			const result = await OrdererUtil.ping(orderer);
			logger.debug(orderer.toString(), result);
			logger.debug(orderer._options['grpc.ssl_target_name_override'], orderer._name.split(':')[0]);
		}

	}

};

task();

