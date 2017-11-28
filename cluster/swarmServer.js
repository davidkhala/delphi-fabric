//TODO work as network map server in Corda : see in readme

const logger = require('../app/util/logger').new('swarm-server')
const express = require('express')
const swarmConfig = require('../config/swarm.json').swarmServer
const bodyParser = require('body-parser')
const http = require('http')
const path = require('path')
const fs = require('fs')
const app = express()
const cors = require('cors')
const config = require('../app/config.json')
const companyConfig = require('../config/orgs.json').delphi
const channelsConfig = companyConfig.channels
const orgsConfig = companyConfig.orgs
const CONFIGTXDir = companyConfig.docker.volumes.CONFIGTX.dir

const helper = require('../app/helper.js')

const port = swarmConfig.port

app.options('*', cors())
app.use(cors())
//support parsing of application/json type post data
app.use(bodyParser.json())
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: false
}))
const server = http.createServer(app).listen(port, () => {
})
logger.info('****************** SERVER STARTED ************************')
logger.info('**************  http://localhost:' + port +
    '  ******************')
server.timeout = 240000
app.use('/config', require('../express/configExpose'))

const swarmJsonPath = path.resolve(path.dirname(__dirname), 'config', 'swarm.json')

if (!fs.existsSync(swarmJsonPath)) {
    logger.error(`${swarmJsonPath} not exist`)
    process.exit(1)
}
const writeFilePretty = ( configObj) => {
    const content = JSON.stringify(configObj, null, 2)
    fs.writeFileSync(swarmJsonPath, JSON.stringify(configObj, null, 2))
    return content
}
app.get('/config', (req, res) => {
    res.json(require(swarmJsonPath))
})
app.post('/:COMPANY/leader/update', (req, res) => {
    const {ip, hostname, managerToken} = req.body
    const {COMPANY} = req.params
    logger.debug({COMPANY})
    const oldConfig = require(swarmJsonPath)
    if (ip) oldConfig[COMPANY].leaderNode.ip = ip
    if (hostname) oldConfig[COMPANY].leaderNode.hostname = hostname
    if (managerToken) oldConfig[COMPANY].leaderNode.managerToken = managerToken

    const content = writeFilePretty(oldConfig)
    res.json(content)

})
/**
 * called after manager node join swarm
 */
app.post('/:COMPANY/manager/join', (req, res) => {
    const {ip, hostname} = req.body
    const {COMPANY} = req.params
    logger.debug('manager join', {COMPANY, ip, hostname})


    const oldConfig = require(swarmJsonPath)
    oldConfig[COMPANY].managerNodes[hostname] = {ip}
    const content =  writeFilePretty(oldConfig)

    res.json(content)

})
app.post('/:COMPANY/manager/leave', (req, res) => {
    const {hostname} = req.body
    const {COMPANY} = req.params
    logger.debug('manager leave', {COMPANY, hostname})
    const oldConfig = require(swarmJsonPath)
    delete oldConfig[COMPANY].managerNodes[hostname]
    const content = writeFilePretty(oldConfig)

    res.json(content)
})
