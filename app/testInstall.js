const install = require('./install-chaincode').install;

const instantiate = require('./instantiate-chaincode').instantiate;
const helper = require('./helper');
const logger = require('./util/logger').new('testInstall');
const chaincodeConfig = require('../config/chaincode.json');
const chaincodeId = 'hashChaincode';
const ClientUtil = require('./util/client');

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path;

const instantiate_args = [];

const chaincodeVersion = 'v0';
const channelName = 'allChannel';
//only one time, one org could deploy
const deploy = (orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);

	return helper.getOrgAdmin(orgName).then((client) => {
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client);
	});
};

deploy('TK.Teeking.com', [0]).then(() => deploy('CAR.Teeking.com', [0])
).then(() => deploy('FACTORY.Teeking.com', [0]).then(()=>deploy('SUPPLY.Teeking.com',[0]))
).then(() => {
	const orgName = 'TK.Teeking.com';
	const peers = helper.newPeers([0], orgName);
	return helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client, true);
		return instantiate(channel, peers, { chaincodeId, chaincodeVersion, args: instantiate_args });
	});

}).catch(err => logger.error(err));

//todo query installed
