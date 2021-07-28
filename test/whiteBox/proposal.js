const Transaction = require('../../common/nodejs/transaction');
const NetworkProfile = require('./network.json');

const path = require('path');
const pwdResolve = (...tokens) => path.resolve(__dirname, ...tokens);

describe('proposal', () => {

	const Peer = require('../../common/nodejs/admin/peer');
	const getPeers = () => {
		const {peers} = NetworkProfile;
		const result = [];
		for (const [peerHostName, {url, tlsCACerts: {path: cert}}] of Object.entries(peers)) {
			const [host, peerPort] = url.split(':');
			const peer = new Peer({host, peerPort, peerHostName, cert});
			result.push(peer);
		}
		return result;
	};
	it('parse network.json to build peers', async () => {
		console.debug(getPeers());
	});
	const User = require('../../common/nodejs/admin/user');
	const getAdmin = (orgName) => {
		const {mspid, users: {Admin: {cert, private_key}}} = NetworkProfile.organizations[orgName];

		const user = new User();
		return user.build({
			keystore: pwdResolve(private_key),
			cert: pwdResolve(cert), mspid
		});
	};


	it('parse network.json to build user', async () => {
		getAdmin('icdd');
		getAdmin('hyperledger');
		getAdmin('astri.org');
	});
	const {emptyChannel} = require('../../common/nodejs/admin/channel');

	it('parse network.json to build Transaction', async function () {
		this.timeout(0);
		const channelName = 'allchannel';
		const channel = emptyChannel(channelName);
		const chaincodeId = 'stress';
		const peers = getPeers();
		const peerAdmin = getAdmin('icdd');
		for (const peer of peers) {
			await peer.connect();
		}
		const transaction = new Transaction(peers, peerAdmin, channel, chaincodeId);

		await transaction.evaluate({});
	});

});
