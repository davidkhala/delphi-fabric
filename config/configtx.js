const globalConfig = require('./orgs.json');
const fs = require('fs');
const path = require('path');
const CURRENT = __dirname;
const yaml = require('js-yaml');
exports.gen = ({
				   consortiumName = 'SampleConsortium',
				   MSPROOT,
				   PROFILE_BLOCK,
				   configtxFile = path.resolve(CURRENT, 'configtx.yaml')

			   }) => {
	const channelsConfig = globalConfig.channels;
	const ordererConfig = globalConfig.orderer;

	//	refresh configtxFile
	if (fs.existsSync(configtxFile)) {
		fs.unlinkSync(configtxFile);
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
			Organizations.push({
				Name: ordererOrgConfig.MSP.name,
				ID: ordererOrgConfig.MSP.id,
				MSPDir: path.join(MSPROOT, 'ordererOrganizations', ordererOrgName, 'msp')
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
		OrdererConfig.Organizations = [
			{
				Name: ordererConfig.solo.MSP.name, ID: ordererConfig.solo.MSP.id,
				MSPDir: path.join(MSPROOT, 'ordererOrganizations', ordererConfig.solo.orgName, 'msp')
			}
		];
	}
	blockProfileConfig.Orderer = OrdererConfig;
	const orgsConfig = globalConfig.orgs;
	const Organizations = [];

	const OrganizationBuilder = (orgName) => {
		const orgConfig = orgsConfig[orgName];
		const anchorPeerConfig = orgConfig.peers[0];
		return {
			Name: orgConfig.MSP.name,
			ID: orgConfig.MSP.id,
			MSPDir: path.join(MSPROOT, 'peerOrganizations', orgName, 'msp'),
			AnchorPeers: [{
				Host: anchorPeerConfig.container_name,
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

	fs.writeFileSync(configtxFile, yaml.safeDump({Profiles}, {lineWidth: 180}));

};
