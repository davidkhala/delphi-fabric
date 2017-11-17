const globalConfig = require('./orgs.json')
const fs = require('fs')
const fsExtra = require('fs-extra')
const path = require('path')
const CURRENT = __dirname
exports.gen = ({
								 COMPANY, MSPROOT,
								 PROFILE_BLOCK = `${COMPANY}Genesis`,
								 configtxFile = path.resolve(CURRENT, 'configtx.yaml')

							 }) => {
	const companyConfig = globalConfig[COMPANY]
	const COMPANY_DOMAIN = companyConfig.domain
	const ordererConfig = companyConfig.orderer
	const ordererContainerPort = ordererConfig.portMap[0].container

//	refresh configtxFile
	fs.unlinkSync(configtxFile)
	const orgsConfig = companyConfig.orgs
	const configtx = {
		Profiles: {
			[PROFILE_BLOCK]: {
				Orderer: {
					OrdererType: 'solo',
					Addresses: [`${ordererConfig.containerName}:${ordererContainerPort}`],
					BatchTimeout: '2s',
					BatchSize: {
						MaxMessageCount: 10,
						AbsoluteMaxBytes: '99 MB',
						PreferredMaxBytes: '512 KB'
					},
					Organizations: [
						{
							Name: ordererConfig.MSP.name, ID: ordererConfig.MSP.id,
							MSPDir:`${MSPROOT}ordererOrganizations/${COMPANY_DOMAIN}/msp`
						}
					]
				}
			}
		}
	}
}
