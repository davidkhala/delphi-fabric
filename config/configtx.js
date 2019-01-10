const globalConfig = require('./orgs.json');
const path = require('path');
const yaml = require('js-yaml');
const {fsExtra} = require('../common/nodejs/helper').nodeUtil.helper();
const {CryptoPath} = require('../common/nodejs/path');
exports.gen = ({consortiumName = 'SampleConsortium', MSPROOT, PROFILE_BLOCK, configtxFile, PROFILE_ANCHORPEERS = 'anchorPeers'}) => {
	const channelsConfig = globalConfig.channels;
	const ordererConfig = globalConfig.orderer;
	if (!configtxFile) {
		configtxFile = path.resolve(__dirname, 'configtx.yaml');
	}
	//	refresh configtxFile
	if (fsExtra.pathExistsSync(configtxFile)) {
		fsExtra.removeSync(configtxFile);
	}


	const blockProfileConfig = {
		Capabilities: {
			V1_3: true // ChannelCapabilities
		}
	};
	const OrdererConfig = {
		BatchTimeout: '1s',
		BatchSize: {
			MaxMessageCount: 1,
			AbsoluteMaxBytes: '99 MB',
			PreferredMaxBytes: '512 KB'
		},
		Capabilities: {
			V1_1: true
		}
	};
	if (globalConfig.orderer.type === 'kafka') {
		OrdererConfig.OrdererType = 'kafka';

		const Addresses = [];
		const Organizations = [];
		for (const ordererOrgName in globalConfig.orderer.kafka.orgs) {
			const ordererOrgConfig = globalConfig.orderer.kafka.orgs[ordererOrgName];
			for (const ordererName in ordererOrgConfig.orderers) {
				Addresses.push(`${ordererName}.${ordererOrgName}:7050`);
			}
			const cryptoPath = new CryptoPath(MSPROOT, {
				orderer: {
					org: ordererOrgName
				}
			});
			Organizations.push({
				Name: ordererOrgName,
				ID: ordererOrgConfig.mspid,
				MSPDir: cryptoPath.ordererOrgMSP()
			});
		}
		OrdererConfig.Addresses = Addresses;

		OrdererConfig.Kafka = {
			Brokers: Object.keys(globalConfig.orderer.kafka.kafkas).map((kafka) => `${kafka}:9092`)
		};
		OrdererConfig.Organizations = Organizations;
	} else {
		OrdererConfig.OrdererType = 'solo';
		const {container_name, orgName, portHost} = ordererConfig.solo;
		OrdererConfig.Addresses = [`${container_name}.${orgName}:${portHost}`];
		const cryptoPath = new CryptoPath(MSPROOT, {
			orderer: {org: ordererConfig.solo.orgName}
		});
		OrdererConfig.Organizations = [
			{
				Name: orgName,
				ID: ordererConfig.solo.mspid,
				MSPDir: cryptoPath.ordererOrgMSP()
			}
		];
	}
	blockProfileConfig.Orderer = OrdererConfig;
	const orgsConfig = globalConfig.orgs;
	const Organizations = [];


	const OrganizationBuilder = (orgName, forAnchor, forChannel) => {
		const orgConfig = orgsConfig[orgName];

		const cryptoPath = new CryptoPath(MSPROOT, {
			peer: {
				org: orgName, name: 'peer0'
			}
		});
		const result = {
			Name: orgName,
			ID: orgConfig.mspid,
			MSPDir: cryptoPath.peerOrgMSP(),
		};
		if (forAnchor) {
			result.AnchorPeers = [{
				Host: cryptoPath.peerHostName,
				Port: 7051
			}];
			delete result.ID;
			delete result.MSPDir;
		}
		if (forChannel) {
			result.AnchorPeers = [{}];
		}
		return result;
	};
	for (const orgName in orgsConfig) {
		Organizations.push(OrganizationBuilder(orgName));
	}
	blockProfileConfig.Consortiums = {
		[consortiumName]: {
			Organizations
		}
	};

	const Profiles = {
		[PROFILE_BLOCK]: blockProfileConfig
	};
	// Write channel profiles
	for (const channelName in channelsConfig) {
		const channelConfig = channelsConfig[channelName];
		const PROFILE_CHANNEL = channelName;
		const Organizations = [];
		for (const orgName in channelConfig.orgs) {
			Organizations.push(OrganizationBuilder(orgName, false, true));
		}
		Profiles[PROFILE_CHANNEL] = {
			Capabilities: {
				V1_3: true
			},
			Consortium: consortiumName,
			Application: {
				Organizations,
				Capabilities: {
					V1_3: true
				}
			}
		};

	}
	// setAnchorPeers profile
	const OrganizationsForAnchorProfile = [];
	for (const orgName in orgsConfig) {
		OrganizationsForAnchorProfile.push(OrganizationBuilder(orgName, true));
	}
	const setAnchorPeersProfile = {
		Application: {
			Organizations: OrganizationsForAnchorProfile
		}
	};
	Profiles[PROFILE_ANCHORPEERS] = setAnchorPeersProfile;

	fsExtra.outputFileSync(configtxFile, yaml.safeDump({Profiles}, {lineWidth: 180}));

};
