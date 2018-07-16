const globalConfig = require('./orgs.json');
const path = require('path');
const yaml = require('js-yaml');
const {CryptoPath, fsExtra} = require('../common/nodejs/path');
exports.gen = ({consortiumName = 'SampleConsortium', MSPROOT, PROFILE_BLOCK, configtxFile}) => {
	const channelsConfig = globalConfig.channels;
	const ordererConfig = globalConfig.orderer;
	if (!configtxFile) configtxFile = path.resolve(__dirname, 'configtx.yaml');
	//	refresh configtxFile
	if (fsExtra.pathExistsSync(configtxFile)) {
		fsExtra.removeSync(configtxFile);
	}


	const blockProfileConfig = {};
	const OrdererConfig = {
		BatchTimeout: '1s',
		BatchSize: {
			MaxMessageCount: 1,
			AbsoluteMaxBytes: '99 MB',
			PreferredMaxBytes: '512 KB'
		},
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
				Name: ordererOrgConfig.MSP.name,
				ID: ordererOrgConfig.MSP.id,
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
				Name: ordererConfig.solo.MSP.name,
				ID: ordererConfig.solo.MSP.id,
				MSPDir: cryptoPath.ordererOrgMSP()
			}
		];
	}
	blockProfileConfig.Orderer = OrdererConfig;
	const orgsConfig = globalConfig.orgs;
	const Organizations = [];


	const OrganizationBuilder = (orgName) => {
		const orgConfig = orgsConfig[orgName];
		const peerIndex = 0;
		const cryptoPath = new CryptoPath(MSPROOT, {
			peer: {
				org: orgName, name: `peer${peerIndex}`
			}
		});
		return {
			Name: orgConfig.MSP.name,
			ID: orgConfig.MSP.id,
			MSPDir: cryptoPath.peerOrgMSP(),
			AnchorPeers: [{
				Host: cryptoPath.peerHostName,
				Port: 7051
			}]
		};
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
	//Write channel profiles
	for (const channelName in channelsConfig) {
		const channelConfig = channelsConfig[channelName];
		const PROFILE_CHANNEL = channelName;
		const Organizations = [];
		for (const orgName in channelConfig.orgs) {
			Organizations.push(OrganizationBuilder(orgName));
		}
		Profiles[PROFILE_CHANNEL] = {
			Consortium: consortiumName,
			Application: {
				Organizations
			}
		};

	}

	fsExtra.outputFileSync(configtxFile, yaml.safeDump({Profiles}, {lineWidth: 180}));

};
