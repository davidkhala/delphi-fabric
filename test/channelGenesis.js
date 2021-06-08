const fs = require('fs');
const ChannelUtil = require('../common/nodejs/channel');
const globalConfig = require('../config/orgs.json');
const Context = require('../nodePkg');
const context = new Context(globalConfig);
describe('channel', () => {
	const channelName = process.env.channel || 'allchannel';
	it('view genesis envelope', () => {
		const ProtoLoader = require('../common/nodejs/builder/protobuf');
		const protobufLoader = new ProtoLoader('/home/davidliu/Documents/delphi-fabric/common/nodejs/node_modules');
		const _commonProto = protobufLoader.require('common/common.proto').common;
		const channelFile = Context.projectResolve('config/configtx/all.tx');
		const config_envelope = fs.readFileSync(channelFile);
		const envelope = _commonProto.Envelope.decode(config_envelope);
		console.log(envelope);
	});
	it('view channel block', async () => {
		const client = context.getOrgAdmin(undefined, 'orderer');

		const channel = context.prepareChannel(channelName, client);
		const orderer = context.newOrderers()[0];
		const block = await ChannelUtil.getGenesisBlock(channel, orderer);
		console.log(block);// TODO apply block decoder
	});
});
