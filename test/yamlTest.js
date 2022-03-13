import * as yaml from '@davidkhala/nodeutils/yaml.js';
import {filedirname} from '@davidkhala/light/es6.mjs';
import path from 'path';

const logger = console;
filedirname(import.meta);
describe('yaml', () => {
	it('read', () => {
		const configtxFile = path.resolve(__dirname, '../config/configtx.yaml');
		const configtxObj = yaml.read(configtxFile);
		logger.debug(Object.keys(configtxObj.Profiles));
	});
});

