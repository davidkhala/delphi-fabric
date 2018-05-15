//TODO This test case requires that the 'configtxlator' tool be running locally and on port 7059
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('test-configtxlator');
const ClientUtil = require('../common/nodejs/client');
const peerUtil = require('../common/nodejs/peer');
const channelName = 'delphiChannel';
const Query = require('../common/nodejs/query');

const join = require('./join-channel').joinChannel;
const instantiate = require('./instantiate-chaincode').instantiate;
const installChaincode = require('./install-chaincode').install;

const api = require('../common/nodejs/configtxlator');
const format_tlscacert = (adminMSPDir, org_domain) => path.join(adminMSPDir, 'tlscacerts',
	`tlsca.${org_domain}-cert.pem`);
/**
 * @Deprecated
 */
exports.deleteOrg = ({channelName, MSPName}) => {
	const client = ClientUtil.new();
	const channel = helper.prepareChannel(channelName, client, true);
	return api.channelUpdate(channel, (update_config) => {
		return api.deleteMSP(update_config, {MSPName});
	});

};
const path = require('path');
const cloneMSP = (original_config, {MSPName, MSPID,  adminMSPDir, org_domain}) => {
// Note templateJson might differs with different channel profile, take care
	let update_config = JSON.parse(JSON.stringify(original_config));
	const admins = [path.join(adminMSPDir, 'admincerts', `Admin@${org_domain}-cert.pem`)];
	const root_certs = [path.join(adminMSPDir, 'cacerts', `ca.${org_domain}-cert.pem`)];

	const tls_root_certs = [format_tlscacert(adminMSPDir, org_domain)];

	update_config = api.newPeerOrg(update_config,MSPName,MSPID,{admins,root_certs,tls_root_certs})
	return update_config;
};
/**
 * @Deprecated
 */
exports.addOrg = (orgName, MSPName, MSPID, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full
	, chaincodePath, chaincodeId, chaincodeVersion, args) => {

	return helper.getOrgAdmin('BU').then((client) => {
		const channel = helper.prepareChannel(channelName, client, true);
		const onUpdate = (original_config) => {
			if (channel.getOrganizations().find((entry) => {
				return entry.id === MSPID;
			})) {
				logger.warn(MSPID, 'msp exist in channel', channel.getName());
				return original_config;
			} else {

				return cloneMSP(original_config, {MSPName, MSPID, adminMSPDir, org_domain});
			}
		};


		const BUpeer0 = helper.newPeers([0], 'BU')[0];
		const BUpeer0EventHub = helper.bindEventHub(BUpeer0, client);
		return api.channelUpdate(channel, onUpdate, BUpeer0EventHub).then(() => {
			return channel.initialize().then(() => {
				const client = ClientUtil.new();
				const keystoreDir = path.join(adminMSPDir, 'keystore');

				const signcertFile = path.join(adminMSPDir, 'signcerts', `Admin@${org_domain}-cert.pem`);
				logger.debug({keystoreDir, signcertFile});
				return helper.userAction.mspCreate(client,
					{keystoreDir, signcertFile, username: 'adminName', orgName, mspid: MSPID}).then(() => {

					const tls_cacerts = format_tlscacert(adminMSPDir, org_domain);
					const peer = peerUtil.new({peerPort, tls_cacerts, peer_hostName_full});

					peer.peerConfig = {
						eventHub: {
							port: eventHubPort,
							clientPromise: Promise.resolve(client)
						}
					};

					channel.addPeer(peer);

					return join(channel, [peer], client).then(() => {
						helper.setGOPATH();
						return installChaincode([peer], {
							chaincodeId,
							chaincodePath,
							chaincodeVersion
						}, client).then(() => {
							return Query.chaincodes.instantiated(peer, channel).then((data) => {
								const {chaincodes} = data;

								if (chaincodes.length === 0) {
									//FIXME: ERRO 63e VSCCValidateTx for transaction txId = de3f4b669ce5ef0d20ecbed3c59aea4d72c18b6e57b83a0e8212c66f00016106 returned error Chaincode delphiChaincode is already instantiated
									//FIXME: but we got chaincodes = []

									return instantiate(channel, [peer], {
										chaincodeId,
										chaincodeVersion,
										args: JSON.parse(args)
									}, client);
								}

							});

						});
					});
				});
			});

		});
	}
	).catch(err => {
		logger.error('addOrg', err);
		process.exit(1);
	});

};
/**
 * @Deprecated
 */
exports.updateOrderer = () => {
	return helper.userAction.admin.orderer.select().then((client) => {

		const channel = helper.prepareChannel(channelName, client);
		const onUpdate = (update_config) => {
			const addresses = [
				'orderer0:7050',
				'orderer2:7050'
			];
			return api.updateOrdererAddresses(update_config, {addresses});
		};
		return api.channelUpdate(channel, onUpdate, client, 'grpc://localhost:7050');
	});
};







