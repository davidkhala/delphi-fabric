/**
 * New feature introduced from 1.1.0-alpha
 */
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
exports.new = (channel,peer)=>{
	channel.newChannelEventHub(peer);
};