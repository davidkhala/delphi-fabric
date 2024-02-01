import fs from 'fs';
import path from 'path';
import {filedirname} from '@davidkhala/light/es6.mjs';
import * as helper from '../app/helper.js';
import {ChannelConfig} from '../common/nodejs/channelConfig.js';
import {consoleLogger} from '@davidkhala/logger/log4.js';
import {Server} from '../common/nodejs/binManager/configtxlator.js';

const logger = consoleLogger('test:configtxlator');
const channelName = 'allchannel';
const orderers = helper.newOrderers();
const orderer = orderers[0];
filedirname(import.meta);
const binPath = path.resolve(__dirname, '../common/bin/');
describe('configtxlator', async () => {

	before(async () => {
		await orderer.connect();
		// viaServer
		const server = new Server(binPath);
		await server.start();

	});
	describe('app channel', () => {

		const user = helper.getOrgAdmin(undefined, 'peer');

		it('read', async () => {
			const channelConfig = new ChannelConfig(channelName, user, orderer, binPath);
			const {json} = await channelConfig.getChannelConfigReadable();
			logger.info(JSON.parse(json));
			fs.writeFileSync(`${channelName}.json`, json);
		});

	});
});




