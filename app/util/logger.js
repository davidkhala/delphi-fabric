const Log4js = require('log4js');
exports.new = (moduleName) => {
	const logger = Log4js.getLogger(moduleName);
	logger.level = 'debug';
	return logger;
};
exports.setGlobal = () => {
	const hfcLogger = module.exports.new('hfc');
	global.hfc = {
		logger: hfcLogger
	};
};
