//TODO This test case requires that the 'configtxlator' tool be running locally and on port 7059
const helper = require('./helper')
const logger = require('./util/logger').new('test-configtxlator')
const ClientUtil = require('./util/client')

const channelName = 'delphiChannel'

const join = require('./join-channel').joinChannel
const instantiate = require('./instantiate-chaincode').instantiate
const installChaincode = require('./install-chaincode').install

const api = require('./configtxlator')

const deleteOrg = ({channelName, MSPName}) => {
    const client = ClientUtil.new()
    const channel = helper.prepareChannel(channelName, client, true)
    return api.channelUpdate(channel, ({update_config}) => {
        return api.deleteMSP({MSPName, update_config})
    })

}
const addOrg = (orgName, MSPName, MSPID, templateMSPName, adminMSPDir, org_domain, peerPort, eventHubPort, peer_hostName_full
    , chaincodePath, chaincodeId, chaincodeVersion, args) => {
    const client = ClientUtil.new()
    const channel = helper.prepareChannel(channelName, client, true)
    return helper.getOrgAdmin("BU", client).then(() => api.channelUpdate(channel,
        ({update_config}) => {
            if (channel.getOrganizations().find((entry) => {
                    return entry.id === MSPID
                })) {
                logger.warn(MSPID, 'msp exist in channel', channel.getName())
                return update_config
            } else {

                return api.cloneMSP({MSPName, MSPID, update_config, templateMSPName, adminMSPDir, org_domain})
            }
        })
    )
        .then(() => {
            return channel.initialize().then(() => {
                helper.userAction.clear(client)
                const keystoreDir = path.join(adminMSPDir, 'keystore')

                const signcertFile = path.join(adminMSPDir, 'signcerts', `Admin@${org_domain}-cert.pem`)
                logger.debug({keystoreDir, signcertFile})
                return helper.userAction.mspCreate(client,
                    {keystoreDir, signcertFile, username: 'adminName', orgName, mspid: MSPID}).then(() => {

                    const tls_cacerts = api.format_tlscacert(adminMSPDir, org_domain)
                    const peer = helper.newPeer({peerPort, tls_cacerts, peer_hostName_full})

                    peer.peerConfig = {
                        eventHub:{
                            port:eventHubPort,
                            clientPromise:Promise.resolve(client)
                        }
                    }

                    channel.addPeer(peer)

                    return join(channel, [peer], client).then(() => {
                        helper.setGOPATH()
                        return installChaincode([peer], {chaincodeId, chaincodePath, chaincodeVersion }, client).then(() => {
                            return instantiate(channel, [peer], {
                                chaincodeId,
                                chaincodeVersion,
                                args: JSON.parse(args)
                            }, client)
                        })
                    })
                })
            })

        }).catch(err => {
            logger.error('addOrg', err)
            process.exit(1)
        })

}
exports.addOrg = addOrg
exports.deleteOrg = deleteOrg






