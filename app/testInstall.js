const install = require('./install-chaincode').install;

const instantiate = require('./instantiate-chaincode').instantiate;
const helper = require('./helper');
const logger = require('../common/nodejs/logger').new('testInstall');
const chaincodeConfig = require('../config/chaincode.json');
const chaincodeId = 'adminChaincode';

const chaincodePath = chaincodeConfig.chaincodes[chaincodeId].path;

const instantiate_args = [];

const chaincodeVersion = 'v0';
const channelName = 'allchannel';
//only one time, one org could deploy
const deploy = (orgName, peerIndexes) => {
	const peers = helper.newPeers(peerIndexes, orgName);

	return helper.getOrgAdmin(orgName).then((client) => {
		return install(peers, { chaincodeId, chaincodePath, chaincodeVersion }, client);
	});
};

deploy('BU.Delphi.com', [0]).then(() => deploy('ENG.Delphi.com', [0])
).then(() => deploy('PM.Delphi.com', [0]).then(()=>deploy('ASTRI.Delphi.com',[0]))
).then(() => {
	const orgName = 'BU.Delphi.com';
	const peers = helper.newPeers([0], orgName);
	return helper.getOrgAdmin(orgName).then((client) => {
		const channel = helper.prepareChannel(channelName, client, true);
		return instantiate(channel, peers, { chaincodeId, chaincodeVersion, args: instantiate_args });
	});

}).catch(err => logger.error(err));

//todo query installed
