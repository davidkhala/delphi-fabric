//TODO work as network map server in Corda : see in readme

const logger = require('../app/util/logger').new('swarm-server');
const express = require('express');
const swarmConfig = require('../config/swarm.json').swarmServer;
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = express();
const cors = require('cors');
const config = require('../app/config.json');
const companyConfig = require('../config/orgs.json');
const channelsConfig = companyConfig.channels;
const orgsConfig = companyConfig.orgs;
const CONFIGTXDir = companyConfig.docker.volumes.CONFIGTX.dir;

const helper = require('../app/helper.js');

const port = swarmConfig.port;

app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: false
}));
const server = http.createServer(app).listen(port, () => {
});
logger.info('****************** SERVER STARTED ************************');
logger.info('**************  http://localhost:' + port +
    '  ******************');
server.timeout = 240000;
app.use('/config', require('../express/configExpose'));

const swarmJsonPath = path.resolve(path.dirname(__dirname), 'config', 'swarm.json');

if (!fs.existsSync(swarmJsonPath)) {
    logger.error(`${swarmJsonPath} not exist`);
    process.exit(1);
}
const writeFilePretty = (configObj) => {
    const content = JSON.stringify(configObj, null, 4);
    fs.writeFileSync(swarmJsonPath, JSON.stringify(configObj, null, 4));
    return content;
};
app.get('/config/swarm', (req, res) => {
    res.json(require(swarmJsonPath));
});
app.post('/leader/update', (req, res) => {
    const {ip, hostname, managerToken} = req.body;
    const oldConfig = require(swarmJsonPath);
    if (ip) oldConfig.leaderNode.ip = ip;
    if (hostname) oldConfig.leaderNode.hostname = hostname;
    if (managerToken) oldConfig.leaderNode.managerToken = managerToken;

    const content = writeFilePretty(oldConfig);
    res.json(content);

});
/**
 * TODO: how to identify a node? ip /hostname or id?
 */
app.post('/manager/join', (req, res) => {
    const {ip, hostname} = req.body;
    logger.debug('manager join', {ip, hostname});


    const oldConfig = require(swarmJsonPath);
    if(oldConfig.managerNodes[hostname]){
        oldConfig.managerNodes[hostname].ip = ip ;
    }else {
        oldConfig.managerNodes[hostname] = {ip};
    }

    const content = writeFilePretty(oldConfig);

    res.json(content);

});
app.post('/manager/leave', (req, res) => {
    const {hostname} = req.body;
    logger.debug('manager leave', {hostname});
    const oldConfig = require(swarmJsonPath);
    delete oldConfig.managerNodes[hostname];
    const content = writeFilePretty(oldConfig);

    res.json(content);
});
//TODO how to hard code services restraint when manager leave??