const ChannelUtil = require('../common/nodejs/channel');
const logger = require('khala-logger/log4js').consoleLogger('channel view');
const helper = require('../app/helper');
describe('channel view', () => {
	const channelName = process.env.channelName || 'allchannel';
	it('view current channel config', async () => {
		const user = helper.getOrgAdmin(undefined, 'orderer');
		const channel = helper.prepareChannel(channelName);
		const orderer = helper.newOrderers()[0];

		await orderer.connect();
		const configBlock = await ChannelUtil.getChannelConfigFromOrderer(channel.name, user, orderer);
		logger.debug('configBlock', configBlock);
	});
	it('view genesis block', async () => {
		const user = helper.getOrgAdmin(undefined, 'orderer');
		const channel = helper.prepareChannel(channelName);
		const orderer = helper.newOrderers()[0];
		await orderer.connect();
		return await ChannelUtil.getGenesisBlock(channel, user, orderer);
	});
});