import {write} from '@davidkhala/nodeutils/yaml.js';
import fsExtra from 'fs-extra';
import {CryptoPath} from '../common/nodejs/path.js';
import {importFrom} from '@davidkhala/light/es6.mjs';

const globalConfig = importFrom('./orgs.json', import.meta);
const {TLS} = globalConfig;
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
export const gen = ({MSPROOT, configtxFile}) => {
	const channelsConfig = globalConfig.channels;
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

	const OrdererConfig = {
		OrdererType: globalConfig.orderer.type,
		BatchTimeout: '2s',
		BatchSize: {
			MaxMessageCount: 10,
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
	const {raftPort} = globalConfig.orderer;
	if (globalConfig.orderer.type === 'etcdraft') {

		const Addresses = [];
		const Organizations = [];
		const Consenters = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
			for (const ordererName in ordererOrgConfig.orderers) {
				const ordererCryptoPath = new CryptoPath(MSPROOT, {
					orderer: {
						org: ordererOrgName, name: ordererName
					}
				});

				const {cert} = ordererCryptoPath.TLSFile('orderer');
				const Host = `${ordererName}.${ordererOrgName}`;
				Addresses.push(`${Host}:7050`);
				const consenter = {Host, Port: TLS ? 7050 : raftPort};

				consenter.ClientTLSCert = cert;
				consenter.ServerTLSCert = cert;

				Consenters.push(consenter);
			}
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, 'orderer'));
		}
		OrdererConfig.Addresses = Addresses;

		OrdererConfig.EtcdRaft = {
			Consenters,
		};
		OrdererConfig.Organizations = Organizations;
	} else if (globalConfig.orderer.type === 'solo') {
		const Addresses = [];
		const Organizations = [];
		for (const [ordererOrgName, ordererOrgConfig] of Object.entries(globalConfig.orderer.organizations)) {
			for (const ordererName in ordererOrgConfig.orderers) {
				const Host = `${ordererName}.${ordererOrgName}`;
				Addresses.push(`${Host}:7050`);
			}
			Organizations.push(OrganizationBuilder(ordererOrgName, ordererOrgConfig, undefined, 'orderer'));
		}
		OrdererConfig.Addresses = Addresses;
		OrdererConfig.Organizations = Organizations;
	}
	const orgsConfig = globalConfig.organizations;

	const Profiles = {};
	// Write channel profiles
	for (const channelName in channelsConfig) {
		const channelConfig = channelsConfig[channelName];
		Profiles[channelName] = {
			Policies: implicitPolicies,
			Capabilities: {
				V2_0: true
			},
			Orderer: OrdererConfig,
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
	write({Profiles}, configtxFile);
};
