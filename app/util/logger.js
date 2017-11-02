const log4js = require('log4js')
exports.new = (moduleName)=> {
	const logger = log4js.getLogger(moduleName)
	logger.setLevel('DEBUG')
	return logger
}