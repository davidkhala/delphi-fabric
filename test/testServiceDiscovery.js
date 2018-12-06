/**
 *  @typedef {Object} PeerQueryRequest
 * @property {Peer | string} target - The {@link Peer} object or peer name to
 *           use for the service discovery request
 * @property {boolean} useAdmin - Optional. Indicates that the admin credentials
 *           should be used in making this call to the peer. An administrative
 *           identity must have been loaded by a connection profile or by
 *           using the 'setAdminSigningIdentity' method.
 */
const helper = require('../app/helper');
const logger = require('../common/nodejs/logger').new('test:serviceDiscovery', true);
const {pretty, globalPeers} = require('../common/nodejs/serviceDiscovery');
const peerList = async () => {
	const org = 'icdd';
	const client = await helper.getOrgAdmin(org, 'peer');
	const peer = helper.newPeers([0], org)[0];
	const discoveries = await globalPeers(client, peer);
	logger.debug(pretty(discoveries));
};
const discoverOrderer = async () => {
//TODO try to get live orderer from channel.initialize
};
const task = async () => {
	await peerList();
};
task();
