import {write} from '@davidkhala/nodeutils/yaml.js';
import {PosixCryptoPath} from '../common/nodejs/path.js';

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

export function OrganizationBuilder(orgName, {mspid, msptype}, mspDir, nodeType = 'peer') {
	const cryptoPath = new PosixCryptoPath(mspDir, {
		[nodeType]: {
			org: orgName
		}
	});
	const result = {
		Name: orgName, // Name is the key by which this org will be referenced in channel configuration transactions.
		ID: mspid, // ID is the key by which this org's MSP definition will be referenced.
		MSPDir: cryptoPath[`${nodeType}OrgMSP`](),
		Policies: {
			Readers: {
				Type: 'Signature',
				Rule: `OR('${mspid}.member')`
			},
			Writers: {
				Type: 'Signature',
				Rule: `OR('${mspid}.member')`
			},
			Admins: {
				Type: 'Signature',
				Rule: `OR('${mspid}.admin')`
			},
			Endorsement: {
				Type: 'Signature',
				Rule: `OR('${mspid}.member')`
			}
		}
	};
	if (msptype === 'idemix') {
		result.msptype = 'idemix';
		result.MSPDir = cryptoPath[`${nodeType}Org`]();// TODO fabric bad design, it have to be upper dir of msp
	}
	return result;
}

export class OrderSectionBuilder {
	constructor(MSPROOT, OrdererType, logger) {
		this.config = {
			OrdererType,
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
			}, implicitPolicies),
			Addresses: [],
			Organizations: [],
			EtcdRaft: {
				Consenters: []
			}
		};
		Object.assign(this, {logger, OrdererType, msp: MSPROOT});
		this.raftPort = 7050;
		if (OrdererType === 'solo') {
			delete this.config.EtcdRaft;
			delete this.raftPort;
		}
	}

	addOrderer(name, org) {
		const ordererCryptoPath = new PosixCryptoPath(this.msp, {
			orderer: {
				org, name
			}
		});
		const Host = ordererCryptoPath.ordererHostName;
		const address = `${Host}:7050`;

		if (this.config.Addresses.includes(address)) {
			this.logger.error(`${address} has been included in ${this.config.Addresses}. Skip addOrderer...`);
			return;
		}
		this.config.Addresses.push(address);

		if (this.OrdererType === 'etcdraft') {
			const {cert} = ordererCryptoPath.TLSFile('orderer');
			this.config.EtcdRaft.Consenters.push({
				Host,
				Port: this.raftPort,
				ClientTLSCert: cert,
				ServerTLSCert: cert
			});
		}
		return this;
	}

	addOrg(org, {mspid, msptype}) {
		if (this.config.Organizations.find(({ID}) => ID === mspid)) {
			this.logger.error(`${mspid} has been included in ${this.config.Organizations}. Skip addOrg...`);
			return;
		}
		this.config.Organizations.push(OrganizationBuilder(org, {mspid, msptype}, this.msp, 'orderer'));
	}

	build() {
		return this.config;
	}

}

export class ConfigtxFileGen {
	constructor(logger) {
		this.Profiles = {};
		this.logger = logger;

	}

	/**
	 * @abstract
	 * @returns {string} 'etcdraft' or 'solo'
	 */
	get OrdererType() {
		return 'etcdraft';
	}

	build(configtxFile) {

		write({Profiles: this.Profiles}, configtxFile);
	}

	/**
	 *
	 * @param profileName
	 * @param {OrderSectionBuilder} orderSectionBuilder
	 * @param Organizations
	 */
	addProfile(profileName, orderSectionBuilder, Organizations) {
		if (this.Profiles[profileName]) {
			this.logger.error(`${profileName} has been included in Profiles. Skip addChannel...`);
			return;
		}
		this.Profiles[profileName] = {
			Policies: implicitPolicies,
			Capabilities: {
				V2_0: true
			},
			Orderer: orderSectionBuilder.build(),
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
				Organizations,
				// Object.keys(channelConfig.organizations).map(orgName => OrganizationBuilder(orgName, orgsConfig[orgName], true)),

				Capabilities: {
					V2_0: true
				}
			}
		};
	}


}
