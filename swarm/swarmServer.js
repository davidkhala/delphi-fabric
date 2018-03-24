//TODO work as network map server in Corda : see in readme

const logger = require('../app/util/logger').new('swarm-server');
const express = require('express');
const swarmConfig = require('./swarm.json').swarmServer;
const {port, couchDB: {url}} = swarmConfig;
const bodyParser = require('body-parser');
const http = require('http');
const app = express();
const cors = require('cors');
const FabricCouchDB = require('fabric-client/lib/impl/CouchDBKeyValueStore');

const swarmDoc = 'swarm';
const volumeDoc = 'volume';
const leaderKey = "leaderNode";
const managerKey = "managerNodes";

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

app.get('/config/swarm', (req, res) => {
    res.json(require(swarmJsonPath));
});
//FIXME async will not prompt error!!!
app.get('/leader', async (req, res) => {
    logger.debug('leader list');
    const connection = await new FabricCouchDB({url, name: swarmDoc});
    const value = await connection.getValue(leaderKey);
    res.json(value);
});
app.post('/leader/update', async (req, res) => {
    const {ip, hostname, managerToken} = req.body;
    logger.debug('leader update', {ip, hostname, managerToken});
    const connection = await new FabricCouchDB({url, name: swarmDoc});
    const value = await connection.setValue(leaderKey, {ip, hostname, managerToken});
    res.json(value);
});

app.get('/manager', async (req, res) => {
    logger.debug('manager list');
    const connection = await new FabricCouchDB({url, name: swarmDoc});
    const value = await connection.getValue(managerKey);
    res.json(value)

});
/**
 * TODO: how to identify a node? ip /hostname or id?
 */
app.post('/manager/join', async (req, res) => {
    const {ip, hostname} = req.body;
    logger.debug('manager join', {ip, hostname});

    const connection = await new FabricCouchDB({url, name: swarmDoc});
    const leaderValue = await connection.getValue(leaderKey);
    if (leaderValue) {
        if (leaderValue.ip === ip) {
            res.send(`request.ip ${ip} conflict with ${leaderKey}.ip`);
            return
        }
        if (leaderValue.hostname === hostname) {
            res.send(`request.hostname ${hostname} conflict with ${leaderKey}.hostname`);
            return
        }
    }

    const value = await connection.getValue(managerKey);
    let newValue;
    if (value) {
        newValue = value;
        if (newValue[ip]) {
            newValue[ip].hostname = hostname;
        } else {
            newValue[ip] = {hostname};
        }

    } else {
        newValue = {[ip]: {hostname}}
    }
    await connection.setValue(managerKey, newValue);
    res.json({ip, hostname});

});
app.post('/manager/leave', async (req, res) => {
    const {ip} = req.body;
    logger.debug('manager leave', {ip});
    const connection = await new FabricCouchDB({url, name: swarmDoc});

    const value = await connection.getValue(managerKey);
    let newValue;
    if (value) {
        newValue = value;
        if (newValue[ip]) {
            delete newValue[ip]
        }
    } else {
        newValue = {}
    }
    await connection.setValue(managerKey, newValue);
    res.json({ip})
});
//TODO how to hard code services restraint when manager leave??
app.post('/volume/get', async (req, res) => {
    const {key} = req.body;
    const connection = await new FabricCouchDB({url, name: volumeDoc});
    const value = await connection.getValue(key);
    res.json(value)
});
app.post('/volume/set', async (req, res) => {
    const {key, value} = req.body;
    const connection = await new FabricCouchDB({url, name: volumeDoc});
    await connection.setValue(key, value);
    res.json({key, value})
});

app.get('/',(req,res)=>{
    res.json({
        errCode:"success",
        errMessage:"pong"
    });
});