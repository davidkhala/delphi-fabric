const {swarmInit,nodeList} = require('../../common/docker/nodejs/dockerode-util');
const {advertiseAddr} = require('../../common/docker/nodejs/dockerCmd');
const logger = require('../../common/nodejs/logger').new('swarm init');
const {ip} = require('../../common/nodejs/helper');
const asyncTask = async (AdvertiseAddr) => {
	if (!AdvertiseAddr) {
		const ips = ip();
		if (ips.length === 1) {
			AdvertiseAddr = ips[0];
		} else if (ips.length > 1) {
			throw `choose AdvertiseAddr among ip: ${ips}`;
		} else {
			throw 'no ip found';
		}
	}
	const exist = await swarmInit({AdvertiseAddr});
	if(exist){
		const nodes = await nodeList(true);
		logger.debug(nodes);
	}


};
asyncTask();