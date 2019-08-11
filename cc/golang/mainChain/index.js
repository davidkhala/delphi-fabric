const {get, put} = require('./invoke');

const helper = require('../../../app/helper');

const install = require('./install');
const org1 = 'icdd';
const org2 = 'astri.org';
const flow = async () => {
	await install.task();

	const p1 = helper.newPeer(0, org1);
	const p2 = helper.newPeer(0, org2);
	const clientOrg = org2;
	await put([p1, p2], clientOrg, 'a', 'abc');
	let result = await get([p1, p2], clientOrg, 'a');
};
// flow();
const channelName = 'allchannel';
const {initialize, getDiscoveryResults, globalPeers} = require('../../../common/nodejs/serviceDiscovery');
const task = async () => {
	const client = await helper.getOrgAdmin(org1);
	const channel = helper.prepareChannel(channelName, client);
	const p1 = helper.newPeer(0, org1);

	await initialize(channel, p1, {asLocalhost: true, TLS: true});
	let result = await getDiscoveryResults(channel);
	console.debug(result);
};
task();
