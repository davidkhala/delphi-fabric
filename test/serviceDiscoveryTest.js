import {consoleLogger} from '@davidkhala/logger/log4.js';
import {ObjectReadable} from '@davidkhala/light/format.js';
import * as helper from '../app/helper.js';
import SlimDiscoveryService from '../common/nodejs/admin/discovery.js';
import UserBuilder from '../common/nodejs/admin/user.js';
import {ParseResult, ParsePeerResult} from '../common/nodejs/formatter/discovery.js';
import {discoveryChaincodeInterestTranslator} from '../app/chaincodeHelper.js';

const {getIdentityContext} = UserBuilder;
const logger = consoleLogger('test:serviceDiscovery');
// TODO to change docker, use docker stop than delete, in order to recover
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
		const result = {};
		for (const [mspid, peers] of Object.entries(members)) {
			result[mspid] = peers.map((peerConfig) => ParsePeerResult(peerConfig));
		}
		return result;
	};
	it('config', async () => {
		slimDiscoveryService.build(identityContext, {config: true});
		const discoveries = await slimDiscoveryService.send();
		const {config_result, members} = ParseResult(discoveries);
		logger.debug('orgs in channel', ObjectReadable(config_result));
		
		peersReader(members);
	});
	it('local: return peers only', async () => {
		slimDiscoveryService.build(identityContext, {local: true});
		const discoveries = await slimDiscoveryService.send();
		const {members} = ParseResult(discoveries);
		// the membership_info is still a FQDN, not a localhost endpoint
		peersReader(members);
	});
	it('local & config', async () => {
		slimDiscoveryService.build(identityContext, {local: true, config: true});
		const discoveries = await slimDiscoveryService.send();
		logger.debug(ParseResult(discoveries));
	});
	it('interest', async () => {

		const interest = discoveryChaincodeInterestTranslator(['diagnose']);
		slimDiscoveryService.build(identityContext, {interest});
		const discoveries = await slimDiscoveryService.send();
		logger.debug(ParseResult(discoveries));
	});

});
