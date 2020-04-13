const globalConfig = require('./orgs.json');
const path = require('path');
const yaml = require('khala-nodeutils/yaml');
const fsExtra = require('fs-extra');
const {CryptoPath} = require('../common/nodejs/path');
const implicitPolicies = require('../common/nodejs/policy').configtxPolicies.implicit.Policies;
const {OrdererType} = require('../common/nodejs/constants');
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

	const OrganizationBuilder = (orgName, orgConfig, anchorIndexes, forChannel, nodeType = 'peer', Addresses) => {
		const cryptoPath = new CryptoPath(MSPROOT, {
			[nodeType]: {
				org: orgName
			}
		});
		const result = {
			Name: orgName,
			ID: orgConfig.mspid,
			MSPDir: cryptoPath[`${nodeType}OrgMSP`](),
			Policies: {
				Readers: {
					Type: 'Signature',
					Rule: `OR('${orgConfig.mspid}.member')`
				},
				Writers: {
					Type: 'Signature',
					Rule: `OR('${orgConfig.mspid}.member')`
				},
				Admins: {
					Type: 'Signature',
					Rule: `OR('${orgConfig.mspid}.admin')`
				}
			}
		};
		if (Array.isArray(anchorIndexes)) {

			result.AnchorPeers = anchorIndexes.map((anchorIndex) => {
				const anchorPeerCryptoPath = new CryptoPath(MSPROOT, {
					peer: {
						org: orgName, name: `peer${anchorIndex}`
					}
				});
				return {
					Host: anchorPeerCryptoPath.peerHostName,
					Port: 7051
				};
			});
			delete result.ID;
			delete result.MSPDir;
			delete result.Policies;
		}
		if (forChannel) {
			result.AnchorPeers = [{}];
		}
		if (Array.isArray(Addresses)) {
			result.OrdererEndpoints = Addresses;
		}
		return result;
	};

	const blockProfileConfig = {
		Capabilities: {
			V1_4_3: true
		},
		Policies: implicitPolicies
	};
	const OrdererConfig = {
		BatchTimeout: '1s',
		Addresses: {}, // empty to overwrite default ['127.0.0.1:7050']
		BatchSize: {
			MaxMessageCount: 1,
			AbsoluteMaxBytes: '99 MB',
			PreferredMaxBytes: '512 KB'
		},
		Capabilities: {
			V1_4_2: true
		},
		Policies: {
			Readers: {
				Type: 'ImplicitMeta',
				Rule: 'ANY Readers'
			},
			Writers: {
				Type: 'ImplicitMeta',
				Rule: 'ANY Writers'
			},
			Admins: {
				Type: 'ImplicitMeta',
				Rule: 'MAJORITY Admins'
			},
			BlockValidation: {
				Type: 'ImplicitMeta',
				Rule: 'ANY Writers'
			}
		}
	};
	let globalOrdererAddresses = [];
	if (ordererConfig.type === OrdererType.kafka) {
		OrdererConfig.OrdererType = OrdererType.kafka;

		const Organizations = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(ordererConfig.kafka.orgs)) {
			const Addresses = Object.keys(ordererOrgConfig.orderers).map(ordererName => `${ordererName}.${ordererOrgName}:7050`);
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, undefined, 'orderer', Addresses));
			globalOrdererAddresses = globalOrdererAddresses.concat(Addresses);
		}

		OrdererConfig.Kafka = {
			Brokers: Object.keys(ordererConfig.kafka.kafkas).map((kafka) => `${kafka}:9092`)
		};
		OrdererConfig.Organizations = Organizations;
	} else if (ordererConfig.type === OrdererType.etcdraft) {
		OrdererConfig.OrdererType = OrdererType.etcdraft;


		const Organizations = [];
		const Consenters = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(ordererConfig.etcdraft.orgs)) {
			const Addresses = [];
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererCryptoPath = new CryptoPath(MSPROOT, {
					orderer: {
						org: ordererOrgName, name: ordererName
					}
				});

				const {cert} = ordererCryptoPath.TLSFile('orderer');
				const Host = `${ordererName}.${ordererOrgName}`;
				Addresses.push(`${Host}:7050`);
				const consenter = {Host, Port: 7050, ClientTLSCert: cert, ServerTLSCert: cert}; // only accept TLS cert
				Consenters.push(consenter);
			}
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, undefined, 'orderer', Addresses));
			globalOrdererAddresses = globalOrdererAddresses.concat(Addresses);
		}

		OrdererConfig.EtcdRaft = {
			Consenters
		};
		OrdererConfig.Organizations = Organizations;
	}
	blockProfileConfig.Orderer = OrdererConfig;
	const orgsConfig = globalConfig.orgs;
	const Organizations = [];


	for (const [orgName, orgConfig] of Object.entries(orgsConfig)) {
		Organizations.push(OrganizationBuilder(orgName, orgConfig, undefined, undefined, 'peer', globalOrdererAddresses));
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
			Organizations.push(OrganizationBuilder(orgName, orgsConfig[orgName], undefined, true));
		}
		Profiles[PROFILE_CHANNEL] = {
			Policies: implicitPolicies,
			Capabilities: {
				V1_4_3: true
			},
			Consortium: consortiumName,
			Application: {
				Policies: implicitPolicies,
				Organizations,
				Capabilities: {
					V1_4_2: true
				}
			}
		};

	}
	// setAnchorPeers profile
	const OrganizationsForAnchorProfile = [];
	for (const [orgName, orgConfig] of Object.entries(orgsConfig)) {
		OrganizationsForAnchorProfile.push(OrganizationBuilder(orgName, orgConfig, [0, 1]));// TODO anchorIndexes as parameters?
	}
	Profiles[PROFILE_ANCHORPEERS] = {
		Application: {
			Organizations: OrganizationsForAnchorProfile
		}
	};
	yaml.write({Profiles}, configtxFile);
};
