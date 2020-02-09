const EventHub = require('../common/nodejs/eventHub');

const channelName = 'allchannel';
const helper = require('../app/helper');
const org = 'astri.org';
const logger = helper.getLogger('test:eventHub');
const ChannelUtil = require('../common/nodejs/channel');

const task = async () => {
	const client = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client, true);
	logger.info(channel.toString());
	ChannelUtil.clearOrderers(channel);
	ChannelUtil.clearPeers(channel);
	const peer = helper.newPeer(0, org);
	const eventHub = new EventHub(channel, peer);

	const startBlock = process.env.startBlock ? parseInt(process.env.startBlock) : undefined;
	await eventHub.connect({startBlock});

	logger.debug('after connect');

	let onSuccess;
	const validator = () => ({valid: true, interrupt: false});
	const onError = (err) => {
		logger.error(err);
	};

	switch (parseInt(process.env.taskID)) {
		case 0:
			// startBlock=0 taskID=0 node test/eventHubTest.js

			onSuccess = (block) => {
				const logger = helper.getLogger(`block ${block.header.number}`);
				for (const data of block.data.data) {
					const dataPayload = data.payload.data;
					if (!dataPayload.config) {
						logger.info('not config block');
						return;
					}
					logger.debug(block);
					logger.debug('data', dataPayload);
					const {config: {channel_group}, last_update} = dataPayload;
					const {groups, values, policies} = channel_group;
					logger.debug('channel_group.groups', groups);
					for (const [ordererOrg, value] of Object.entries(groups.Orderer.groups)) {
						logger.debug('channel_group.groups.Orderer.groups', ordererOrg, value);
						logger.debug('channel_group.groups.Orderer.groups.Admins', ordererOrg, value.policies.Admins.policy, value.policies.Admins.policy.value.identities);
						logger.debug('channel_group.groups.Orderer.groups.Readers', ordererOrg, value.policies.Readers.policy);
						logger.debug('channel_group.groups.Orderer.groups.Writers', ordererOrg, value.policies.Writers.policy);
					}

					logger.debug('channel_group.groups.Application', groups.Application);
					logger.debug('channel_group.values', values);
					logger.debug('channel_group.policies', policies);
					logger.debug(policies.Readers.policy.value);
					logger.debug(policies.Writers.policy.value);
					logger.debug(policies.Admins.policy.value);

					logger.info('last_update', last_update.payload);
					logger.info('last_update.read_set', last_update.payload.data.config_update.read_set);
					logger.info('last_update.read_set.groups', Object.keys(last_update.payload.data.config_update.read_set.groups.Application.groups));

					logger.info('last_update.write_set', last_update.payload.data.config_update.write_set);
				}
			};
			break;
		case 1:
			// startBlock=0 taskID=1 node test/eventHubTest.js
			onSuccess = (block) => {
				const logger = helper.getLogger(`block ${block.header.number}`);
				for (const data of block.data.data) {
					const {actions} = data.payload.data;
					if (!actions) {
						logger.info(block.header.number, 'not tx action block');
						return;
					}
					logger.debug(block);
					logger.debug('actions', actions);
					for (const {payload} of actions) {
						const {chaincode_proposal_payload, action} = payload;
						const {chaincode_spec} = chaincode_proposal_payload.input;
						if (chaincode_spec.chaincode_id.name !== 'lscc') {
							logger.info('not deploy chaincode tx');
							continue;
						}
						logger.debug('chaincode_proposal_payload', chaincode_spec);
						logger.debug('chaincode_proposal_payload.input.args', chaincode_spec.input.args.map(arg => arg.toString('utf8')));
						logger.debug('action', action);
						const {results, events, response, chaincode_id} = action.proposal_response_payload.extension;
						logger.debug('action.results', results.ns_rwset);
						logger.debug('action.events', events);
						logger.debug('action.response', response);
						logger.debug('action.chaincode_id', chaincode_id);
						for (const {namespace, rwset, collection_hashed_rwset} of results.ns_rwset) {
							for (const {hashed_rwset} of collection_hashed_rwset) {
								const {hashed_reads, hashed_writes} = hashed_rwset;
								for (const prSet of hashed_reads) {
									logger.debug('private read set', prSet);
								}
							}
							const {reads, range_queries_info, writes, metadata_writes} = rwset;
							for (const {key, version} of reads) {
								logger.debug(`read key[${key}]`, version);
							}
							for (const {key, is_delete, value} of writes) {
								logger.debug(`write key[${key}] `, value, is_delete ? 'as delete' : '');
							}
						}

					}
				}
			};
			break;
		case 2:
			// startBlock=0 taskID=2 node test/eventHubTest.js
			onSuccess = (block) => {
				const logger = helper.getLogger(`block ${block.header.number}`);
				for (const data of block.data.data) {
					const {actions} = data.payload.data;
					if (!actions) {
						logger.info(block.header.number, 'not tx action block');
						return;
					}
					logger.debug(block);
					logger.debug('actions', actions);
					for (const {payload} of actions) {
						const {action} = payload;

						const {extension} = payload.action.proposal_response_payload;
						logger.debug('action extension', extension);
						const {ns_rwset} = extension.results;
						logger.debug('read write set', ns_rwset);
						for (const {rwset, collection_hashed_rwset} of ns_rwset) {
							for (const {hashed_rwset} of collection_hashed_rwset) {
								const {hashed_reads, hashed_writes} = hashed_rwset;
								for (const prSet of hashed_reads) {
									logger.debug('private read set', prSet);
								}
							}
							const {reads, range_queries_info, writes, metadata_writes} = rwset;
							for (const read of reads) {
								logger.debug(read);
							}
						}

					}
				}
			};
			break;
	}
	eventHub.blockEvent(validator, onSuccess, onError);
};
task();
