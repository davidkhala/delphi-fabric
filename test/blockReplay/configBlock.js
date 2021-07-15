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

	const validator = () => ({valid: true, interrupt: false});
	const onError = (err) => {
		logger.error(err);
	};


	// startBlock=0 node blockReplay/configBlock.js

	const onSuccess = (block) => {
		const logger = require('khala-logger/log4js').consoleLogger(`block ${block.header.number}`);
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
				logger.debug('channel_group.groups.Orderer.groups.Readers', ordererOrg, value.policies.Readers.policy, value.policies.Readers.policy.value.identities);
				logger.debug('channel_group.groups.Orderer.groups.Writers', ordererOrg, value.policies.Writers.policy, value.policies.Writers.policy.value.identities);
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

	eventHub.blockEvent(validator, onSuccess, onError);
};
task();
