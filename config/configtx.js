const globalConfig = require('./orgs.json');
const {TLS} = globalConfig;
const path = require('path');
const yaml = require('../common/nodejs/helper').nodeUtil.yaml();
const {fsExtra} = require('../common/nodejs/helper').nodeUtil.helper();
const {CryptoPath} = require('../common/nodejs/path');
const implicitPolicies = require('../common/nodejs/policy').configtxPolicies.implicit.Policies;
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
		if (nodeType === 'orderer' && Array.isArray(Addresses)) {
			result.OrdererEndpoints = Addresses;
		}
		return result;
	};

	const blockProfileConfig = {
		Capabilities: {
			V1_3: true
		},
		Policies: implicitPolicies
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
	if (globalConfig.orderer.type === 'kafka') {
		OrdererConfig.OrdererType = 'kafka';


		const Organizations = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.kafka.orgs)) {
			const Addresses = Object.keys(ordererOrgConfig.orderers).map(ordererName => `${ordererName}.${ordererOrgName}:7050`);
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, undefined, 'orderer', Addresses));
		}

		OrdererConfig.Kafka = {
			Brokers: Object.keys(globalConfig.orderer.kafka.kafkas).map((kafka) => `${kafka}:9092`)
		};
		OrdererConfig.Organizations = Organizations;
	} else if (globalConfig.orderer.type === 'solo') {
		OrdererConfig.OrdererType = 'solo';
		const {container_name, orgName, portHost} = ordererConfig.solo;

		OrdererConfig.Organizations = [
			OrganizationBuilder(orgName, ordererConfig.solo, undefined, undefined, 'orderer', [`${container_name}.${orgName}:${portHost}`])
		];
	} else if (globalConfig.orderer.type === 'etcdraft') {
		OrdererConfig.OrdererType = 'etcdraft';


		const Organizations = [];
		const Consenters = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.etcdraft.orgs)) {
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
				const consenter = {Host, Port: 7050};
				if (TLS) {
					consenter.ClientTLSCert = cert;
					consenter.ServerTLSCert = cert;
				}
				Consenters.push(consenter);
			}
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, undefined, 'orderer', Addresses));
		}

		const HeartbeatTick = 1;
		OrdererConfig.EtcdRaft = {
			Consenters,
			Options: {
				TickInterval: '500ms', // the time interval between two Node.Tick invocations.
				ElectionTick: Math.max(10, HeartbeatTick + 1),
				HeartbeatTick,     // a leader sends heartbeat messages to maintain its leadership every HeartbeatTick ticks.
				MaxInflightBlocks: 5, // TODO limits the max number of in-flight append messages during optimistic replication phase.
				SnapshotIntervalSize: '20 MB' // TODO number of bytes per which a snapshot is taken
			}
		};
		OrdererConfig.Organizations = Organizations;
	}
	blockProfileConfig.Orderer = OrdererConfig;
	const orgsConfig = globalConfig.orgs;
	const Organizations = [];


	for (const [orgName, orgConfig] of Object.entries(orgsConfig)) {
		Organizations.push(OrganizationBuilder(orgName, orgConfig));
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
				V1_4_2: true
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
