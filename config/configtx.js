const globalConfig = require('./orgs.json');
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

		const Addresses = [];
		const Organizations = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.kafka.orgs)) {
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
	} else if (globalConfig.orderer.type === 'solo') {
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
	} else if (globalConfig.orderer.type === 'etcdraft') {
		OrdererConfig.OrdererType = 'etcdraft';

		const Addresses = [];
		const Organizations = [];
		const Consenters = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.etcdraft.orgs)) {
			const cryptoPath = new CryptoPath(MSPROOT, {
				orderer: {
					org: ordererOrgName
				}
			});
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererCryptoPath = new CryptoPath(MSPROOT, {
					orderer: {
						org: ordererOrgName, name: ordererName
					}
				});

				const {cert} = ordererCryptoPath.TLSFile('orderer');
				const Host = `${ordererName}.${ordererOrgName}`;
				Addresses.push(`${Host}:7050`);
				Consenters.push({Host, Port: 7050, ClientTLSCert: cert, ServerTLSCert: cert});
			}

			Organizations.push({
				Name: ordererOrgName,
				ID: ordererOrgConfig.mspid,
				MSPDir: cryptoPath.ordererOrgMSP()
			});
		}
		OrdererConfig.Addresses = Addresses;

		const HeartbeatTick = 1;
		OrdererConfig.EtcdRaft = {
			Consenters,
			Options: {
				TickInterval: '500ms',
				ElectionTick: Math.max(10, HeartbeatTick + 1),
				HeartbeatTick,
				MaxInflightBlocks: 5,
				SnapshotIntervalSize: '20 MB'
			}
		};
		OrdererConfig.Organizations = Organizations;
	}
	blockProfileConfig.Orderer = OrdererConfig;
	const orgsConfig = globalConfig.orgs;
	const Organizations = [];


	const OrganizationBuilder = (orgName, anchorIndexes, forChannel) => {
		const orgConfig = orgsConfig[orgName];

		const cryptoPath = new CryptoPath(MSPROOT, {
			peer: {
				org: orgName
			}
		});
		const result = {
			Name: orgName,
			ID: orgConfig.mspid,
			MSPDir: cryptoPath.peerOrgMSP(),
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
			Policies: implicitPolicies,
			Capabilities: {
				V1_3: true
			},
			Consortium: consortiumName,
			Application: {
				Policies: implicitPolicies,
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
		OrganizationsForAnchorProfile.push(OrganizationBuilder(orgName, [0, 1]));// TODO anchorIndexes as parameters?
	}
	const setAnchorPeersProfile = {
		Application: {
			Organizations: OrganizationsForAnchorProfile
		}
	};
	Profiles[PROFILE_ANCHORPEERS] = setAnchorPeersProfile;

	yaml.write({Profiles}, configtxFile);
};
