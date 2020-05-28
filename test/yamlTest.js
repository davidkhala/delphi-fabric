const yaml = require('khala-nodeutils/yaml');
const logger = require('khala-logger/log4js').consoleLogger('yaml');

const path = require('path');
describe('yaml', () => {
	it('read', () => {
		const configtxFile = path.resolve(__dirname, '../config/configtx.yaml');
		const configtxObj = yaml.read(configtxFile);
		logger.debug(Object.keys(configtxObj.Profiles));
	});
});

