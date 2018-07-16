exports.invalid = () => {
	const companyConfig = require('../config/orgs.json');
	const channelsConfig = companyConfig.channels;
	const orgsConfig = companyConfig.orgs;
	const chaincodesConfig = require('../config/chaincode.json');

	const orgNameFcn = ({orgName}) => {
		const orgConfig = orgsConfig[orgName];
		if (!orgConfig) {
			throw Error(`config of org '${orgName}' not found`);
		}
	};
	return {
		orgName: orgNameFcn,
		channelName: ({channelName}) => {
			const channelConfig = channelsConfig[channelName];
			if (!channelConfig) {
				throw Error(`config of channel '${channelName}' not found`);
			}
		},
		peer: ({orgName, peerIndex}) => {
			orgNameFcn({orgName});

			const orgConfig = orgsConfig[orgName];
			const peerConfig = orgConfig.peers[peerIndex];
			if (!peerConfig) {
				throw Error(`config of peer${peerIndex}.${orgName} not found`);
			}
		},
		args: ({args}) => {
			if (!Array.isArray(args)) {
				throw Error(`invalid Arguments:args must be an array but got:${args}`);
			}
		},
		chaincodeId: ({chaincodeId}) => {
			const chaincodeConfig = chaincodesConfig.chaincodes[chaincodeId];
			if (!chaincodeConfig) {
				throw Error(`config of chaincode ${chaincodeId} not found`);
			}
		}
	};
};

