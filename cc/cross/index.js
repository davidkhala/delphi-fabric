const install = require('./crossInstall');
const {put, get} = require('./crossInvoke');
const logger = require('../../common/nodejs/logger').new('crossCC');

const flow = async () => {
	await install.task();
	const key = await put();
	try {
		const value2 = await get(key);
		logger.debug({value2});
	} catch (err) {
		logger.error(err);
	}
};
flow();