const EventHub = require('../../common/nodejs/builder/eventHub');

const channelName = 'allchannel';
const helper = require('../../app/helper');
const org = 'astri.org';
const logger = require('khala-logger/log4js').consoleLogger('test:eventHub');

const task = async () => {
	const client = helper.getOrgAdmin(org, 'peer');
	const channel = helper.prepareChannel(channelName, client);
	logger.info(channel.toString());
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
		case 1:
			// startBlock=0 taskID=1 node blockReplay/txBlock.js
			onSuccess = (block) => {
				const logger = require('khala-logger/log4js').consoleLogger(`block ${block.header.number}`);
				for (const data of block.data.data) {
					const {actions} = data.payload.data;
					if (!actions) {
						logger.info(block.header.number, 'not tx action block');
						return;
					}
					logger.debug(`found ${actions.length} actions`);

					for (const {payload, header} of actions) {
						logger.warn({header});
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
			// startBlock=0 taskID=2 node blockReplay/txBlock.js
			onSuccess = (block) => {
				const logger = require('khala-logger/log4js').consoleLogger(`block ${block.header.number}`);
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
