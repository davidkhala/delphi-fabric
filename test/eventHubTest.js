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
	await eventHub.connect();

	logger.debug('after connect');
	const blockEventListener = eventHub.blockEvent(() => {
		return {valid: true, interrupt: false};
	}, (block) => {
		logger.debug(block.header.number);
		for (const data of block.data.data) {
			const dataPayload = data.payload.data;
			logger.debug('data', dataPayload);
			if (dataPayload.config) {

			} else {
				const {actions} = dataPayload;
				for (const {payload} of actions) {
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
		}
		eventHub.unregisterBlockEvent(blockEventListener);
		eventHub.disconnect();
	}, (err) => {
		logger.error(err);
	});
};
task();
