const logger = require('../common/nodejs/logger').new('configtxlator');

const path = require('path');
const fs = require('fs');
const agent = require('../common/nodejs/agent2configtxlator');
const OrdererUtil = require('../common/nodejs/orderer');
const EventHubUtil = require('../common/nodejs/eventHub');


exports.newPeerOrg = (original_config, MSPName, MSPID, {admins = [], root_certs = [], tls_root_certs = []} = {}) => {
	const update_config = Object.assign({}, original_config);
	update_config.channel_group.groups.Application.groups[MSPName] = {
		'mod_policy': 'Admins',
		'policies': {
			'Admins': {
				'mod_policy': 'Admins',
				'policy': {
					'type': 1,
					'value': {
						'identities': [
							{
								'principal': {
									'msp_identifier': MSPID,
									'role': 'ADMIN'
								}
							}
						],
						'rule': {
							'n_out_of': {
								'n': 1,
								'rules': [
									{
										'signed_by': 0
									}
								]
							}
						}
					}
				}
			},
			'Readers': {
				'mod_policy': 'Admins',
				'policy': {
					'type': 1,
					'value': {
						'identities': [
							{
								'principal': {
									'msp_identifier': MSPID
								}
							}
						],
						'rule': {
							'n_out_of': {
								'n': 1,
								'rules': [
									{
										'signed_by': 0
									}
								]
							}
						}
					}
				}
			},
			'Writers': {
				'mod_policy': 'Admins',
				'policy': {
					'type': 1,
					'value': {
						'identities': [
							{
								'principal': {
									'msp_identifier': MSPID
								}
							}
						],
						'rule': {
							'n_out_of': {
								'n': 1,
								'rules': [
									{
										'signed_by': 0
									}
								]
							}
						}
					}
				}
			}
		},
		'values': {
			'MSP': {
				'mod_policy': 'Admins',
				'value': {
					'config': {
						'admins': admins.map(admin => {
							return fs.readFileSync(admin).toString('base64');
						}),
						'crypto_config': {
							'identity_identifier_hash_function': 'SHA256',
							'signature_hash_family': 'SHA2'
						},
						'name': MSPID,
						'root_certs': root_certs.map(rootCert => {
							return fs.readFileSync(rootCert).toString('base64');
						}),
						'tls_root_certs': tls_root_certs.map(tlsRootCert => {
							return fs.readFileSync(tlsRootCert).toString('base64');
						})
					}
				}
			}
		}
	};
	return update_config;
};
exports.deleteMSP = (update_config, {MSPName}) => {
	delete update_config.channel_group.groups.Application.groups[MSPName];
	return update_config;
};

// This test case requires that the 'configtxlator' tool be running locally and on port 7059
// fixme :run configtxlator.server with nodejs child_process, program will hang and no callback or stdout

const getChannelConfigReadable = async (channel) => {
	const configEnvelope = await channel.getChannelConfig();
	//NOTE JSON.stringify(data ) :TypeError: Converting circular structure to JSON
	const original_config_proto = configEnvelope.config.toBuffer();
	channel.loadConfigEnvelope(configEnvelope);//TODO redundant?

	// lets get the config converted into JSON, so we can edit JSON to
	// make our changes
	const {body} = await agent.decode.config(original_config_proto);
	return {
		original_config_proto,
		original_config: JSON.parse(body)
	};
};
exports.channelUpdate = async (channel, mspCB, signatureCollectCB, eventHub, client = channel._clientContext, {ordererUrl} = {}) => {
	const orderer = OrdererUtil.find({orderers: channel.getOrderers(), ordererUrl});

	eventHub._clientContext = client;

	const ERROR_NO_UPDATE = 'No update to original_config';
	const {original_config_proto, original_config} = await getChannelConfigReadable(channel);
	logger.debug(original_config.channel_group.groups.Application.groups);
	fs.writeFileSync(path.join(__dirname, `${channel.getName()}-txlator.json`), JSON.stringify(original_config));// for debug only
	const update_config = await mspCB(original_config);
	if (update_config === original_config) {
		logger.warn(ERROR_NO_UPDATE);
		return {err: ERROR_NO_UPDATE, original_config};
	}
	const {body} = await agent.encode.config(JSON.stringify(update_config));
	//NOTE: after delete MSP, deleted peer retry to connect to previous channel
	// PMContainerName.delphi.com       | 2017-08-24 03:02:55.815 UTC [blocksProvider] DeliverBlocks -> ERRO 2ea [delphichannel] Got error &{FORBIDDEN}
	// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [cauthdsl] func1 -> DEBU ea5 0xc420028c50 gate 1503543775814648321 evaluation fails
	// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [orderer/common/deliver] Handle -> WARN ea6 [channel: delphichannel] Received unauthorized deliver request
	// orderContainerName.delphi.com    | 2017-08-24 03:02:55.814 UTC [cauthdsl] func2 -> ERRO e9d Principal deserialization failure (MSP PMMSP is unknown)

	// PMContainerName.delphi.com       | 2017-08-24 03:03:15.823 UTC [deliveryClient] RequestBlocks -> DEBU 2ed Starting deliver with block [1] for channel delphichannel
	// PMContainerName.delphi.com       | 2017-08-24 03:03:15.824 UTC [blocksProvider] DeliverBlocks -> ERRO 2ee [delphichannel] Got error &{FORBIDDEN}
	// PMContainerName.delphi.com       | 2017-08-24 03:03:15.824 UTC [blocksProvider] DeliverBlocks -> CRIT 2ef [delphichannel] Wrong statuses threshold passed, stopping block provider
	const formData = {
		channel: channel.getName(),
		original: {
			value: original_config_proto,
			options: {
				filename: 'original.proto',
				contentType: 'application/octet-stream'
			}
		},
		updated: {
			value: body,
			options: {
				filename: 'updated.proto',
				contentType: 'application/octet-stream'
			}
		}
	};
	const {body: body2} = await agent.compute.updateFromConfigs(formData);
	const {signatures, proto} = await signatureCollectCB(new Buffer(body2, 'binary'));

	const request = {
		config: proto,
		signatures,
		name: channel.getName(),
		orderer,
		txId: client.newTransactionID()
	};

	const updateChannelResp = await client.updateChannel(request);
	logger.info('updateChannel', updateChannelResp);
	const {block} = await new Promise((resolve, reject) => {
		const onSucc = (_) => resolve(_);
		const onErr = (e) => reject(e);
		EventHubUtil.blockEvent(eventHub, undefined, onSucc, onErr);
	});
	logger.info('new Block', block);
	return block;
};


exports.updateKafkaBrokers = (update_config, {brokers}) => {
	update_config.channel_group.groups.Orderer.values.KafkaBrokers.value.brokers = brokers;
	return update_config;
};
exports.updateOrdererAddresses = (update_config, {addresses}) => {
	update_config.channel_group.values.OrdererAddresses.value.addresses = addresses;
	return update_config;
};


