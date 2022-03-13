import * as helper from '../app/helper.js';
import assert from 'assert';
import {consoleLogger} from '@davidkhala/logger/log4.js';

const logger = consoleLogger('test:peer');
describe('peer', () => {
	it('ping', async () => {
		const peers = helper.allPeers();
		for (const peer of peers) {
			const result = await peer.ping(peer);
			logger.debug(peer.toString(), result);
		}
	});
	it('reconnect', async () => {
		// TODO leakage hang for a few seconds
		const peers = helper.allPeers();
		for (const peer of peers) {
			await peer.connect();
			await peer.disconnect();
			await peer.connect();
			await peer.disconnect();
		}
	});
	it('reconnect:streaming', async () => {
		// TODO leakage hang for a few seconds
		const peers = helper.allPeers();
		for (const peer of peers) {
			await peer.connectStream();
			assert.ok(peer.isStreamReady());
			await peer.disconnectStream();
			assert.ok(!peer.isStreamReady());

			await peer.connectStream();
			assert.ok(peer.isStreamReady());
			await peer.disconnectStream();
		}
	});
});
