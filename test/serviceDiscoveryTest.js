const helper = require('../app/helper');
const logger = require('khala-logger/log4js').consoleLogger('test:serviceDiscovery');
const SlimDiscoveryService = require('../common/nodejs/admin/discovery');
const {getIdentityContext} = require('../common/nodejs/admin/user');
const DockerManager = require('khala-dockerode/docker');
const dockerManager = new DockerManager();
const {ParseResult, ParsePeerResult} = require('../common/nodejs/formatter/discovery');
describe('change container', () => {
	it('deletePeer', async () => {
		const containerName = 'peer0.astri.org';
		await dockerManager.containerDelete(containerName);
	});
	it('deleteOrderer', async () => {
		const ordererContainer = 'orderer0.icdd.astri.org';
		await dockerManager.containerDelete(ordererContainer);
	});
});
describe('discovery', () => {
	const org = 'icdd';
	const peer = helper.newPeer(0, org);
	const slimDiscoveryService = new SlimDiscoveryService('allchannel', peer.discoverer);

	const user = helper.getOrgAdmin(org, 'peer');
	const identityContext = getIdentityContext(user);
	beforeEach(async () => {
		await peer.connect();
	});
	const peersReader = (members) => {
		for (const [mspid, peers] of Object.entries(members)) {
			for (const peerConfig of peers) {
				const peerConfig1 = ParsePeerResult(peerConfig);
				logger.debug(peerConfig1);
			}
		}
	};
	it('config', async () => {
		slimDiscoveryService.build(identityContext, {config: true});
		const discoveries = await slimDiscoveryService.send();
		const {config_result, members} = ParseResult(discoveries);
		logger.debug('orgs in channel', config_result);
		peersReader(members);
	});
	it('local: return peers only', async () => {
		slimDiscoveryService.build(identityContext, {local: true});
		const discoveries = await slimDiscoveryService.send();
		const trimmedResult = ParseResult(discoveries);
		peersReader(trimmedResult.members);
	});
	it('local & config', async () => {
		slimDiscoveryService.build(identityContext, {local: true, config: true});
		const discoveries = await slimDiscoveryService.send();
		logger.debug(ParseResult(discoveries));
	});
	it('interest', async () => {
		const {discoveryChaincodeInterestTranslator} = require('../app/chaincodeHelper');
		const interest = discoveryChaincodeInterestTranslator(['diagnose']);
		slimDiscoveryService.build(identityContext, {interest});
		const discoveries = await slimDiscoveryService.send();
		logger.debug(ParseResult(discoveries));
	});

});
