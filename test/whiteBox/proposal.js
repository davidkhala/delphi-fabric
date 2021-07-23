const Transaction = require('../../common/nodejs/transaction');
const NetworkProfile = require('./network.json');
const {TLS} = require('../../config/orgs.json');
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
const {Endorser, Endpoint, Discoverer} = require('fabric-common');
const fs = require('fs');
const assert = require('assert');

describe('yeasy simple3', () => {
	const cryptoRoot = path.resolve(__dirname, '../../config/ca-crypto-config');
	const orgName = 'icdd';

	const cert = path.resolve(cryptoRoot, 'peerOrganizations', orgName, 'tlsca', `tlsca.${orgName}-cert.pem`);
	const pem = fs.readFileSync(cert).toString();

	const peerPort = 8051;
	const host = 'localhost';
	const peerURL = `grpcs://${host}:${peerPort}`;
	const peerHost = 'peer0.icdd';

	const mspId = 'icddMSP';
	it('connect', async function () {
		this.timeout(0);

		const options = {
			url: peerURL,
			'grpc-wait-for-ready-timeout': 30000
		};
		if (TLS) {
			Object.assign(options, {pem, 'grpc.ssl_target_name_override': peerHost});
		}
		const endpoint = new Endpoint(options);


		const endorser = new Endorser('myEndorser', {}, mspId);
		endorser.setEndpoint(endpoint);
		await endorser.connect(endpoint);


		let isConnected = await endorser.checkConnection();
		assert.ok(isConnected);


		// test using discoverer
		const discoverer = new Discoverer('myDiscoverer', {}, mspId);
		discoverer.setEndpoint(endpoint);

		await discoverer.connect();
		isConnected = await discoverer.checkConnection();
		assert.ok(isConnected);
	});

});