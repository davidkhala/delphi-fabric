import * as yaml from '@davidkhala/nodeutils/yaml.js';
import path from 'path';

const logger = console;
describe('yaml', () => {
	it('read', () => {
		const configtxFile = path.resolve(__dirname, '../config/configtx.yaml');
		const configtxObj = yaml.read(configtxFile);
		logger.debug(Object.keys(configtxObj.Profiles));
	});
});

