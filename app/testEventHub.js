const ChannelEventHubUtil = require('./util/channelEventHub');
const helper = require('./helper');
const channelName= 'delphiChannel';
const client  = require('./util/client').new();
helper.prepareChannel(channelName,client).then(()=>{
	ChannelEventHubUtil.new();
});
