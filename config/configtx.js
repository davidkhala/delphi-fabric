const globalConfig = require('./orgs.json');
const {TLS} = globalConfig;
const path = require('path');
const yaml = require('khala-nodeutils/yaml');
const fsExtra = require('fs-extra');
const {CryptoPath} = require('../common/nodejs/path');
const implicitPolicies = {
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
	}
};
exports.gen = ({consortiumName = 'SampleConsortium', MSPROOT, PROFILE_BLOCK, configtxFile}) => {
	const channelsConfig = globalConfig.channels;
	if (!configtxFile) {
		configtxFile = path.resolve(__dirname, 'configtx.yaml');
	}
	//	refresh configtxFile
	if (fsExtra.pathExistsSync(configtxFile)) {
		fsExtra.removeSync(configtxFile);
	}

	const OrganizationBuilder = (orgName, orgConfig, forChannel, nodeType = 'peer') => {
		const cryptoPath = new CryptoPath(MSPROOT, {
			[nodeType]: {
				org: orgName
			}
		});
		const result = {
			Name: orgName, // Name is the key by which this org will be referenced in channel configuration transactions.
			ID: orgConfig.mspid, // ID is the key by which this org's MSP definition will be referenced.
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
				},
				Endorsement: {
					Type: 'Signature',
					Rule: `OR('${orgConfig.mspid}.member')`
				}
			}
		};
		if (orgConfig.msptype === 'idemix') {
			result.msptype = 'idemix';
			result.MSPDir = cryptoPath[`${nodeType}Org`]();// TODO fabric bad design, it have to be upper dir of msp
		}
		return result;
	};

	const blockProfileConfig = {
		Capabilities: {
			V2_0: true
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
			V2_0: true
		},
		Policies: Object.assign({
			BlockValidation: {
				Type: 'ImplicitMeta',
				Rule: 'ANY Writers'
			}
		}, implicitPolicies)
	};
	if (globalConfig.orderer.type === 'etcdraft') {
		OrdererConfig.OrdererType = 'etcdraft';

		const Addresses = [];
		const Organizations = [];
		const Consenters = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.etcdraft.organizations)) {
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
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, 'orderer'));
		}
		OrdererConfig.Addresses = Addresses;

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
	const orgsConfig = globalConfig.organizations;
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
		Profiles[PROFILE_CHANNEL] = {
			Policies: implicitPolicies,
			Capabilities: {
				V2_0: true
			},
			Consortium: consortiumName,
			Application: {
				Policies: Object.assign({
					LifecycleEndorsement:
						{
							Type: 'ImplicitMeta',
							Rule: 'MAJORITY Endorsement'
						},
					Endorsement: {
						Type: 'ImplicitMeta',
						Rule: 'MAJORITY Endorsement'
					}
				}, implicitPolicies),
				Organizations: Object.keys(channelConfig.organizations).map(orgName => OrganizationBuilder(orgName, orgsConfig[orgName], true)),
				Capabilities: {
					V2_0: true
				}
			}
		};

	}
	yaml.write({Profiles}, configtxFile);
};
