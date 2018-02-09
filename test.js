const Logger = require('./app/util/logger')
// Logger.setGlobal();
const Helper = require('./app/helper');
const ClientUtil = require('./app/util/client')
const client = ClientUtil.new();
Helper.getOrgAdmin('BU',client).then((client)=>{

})
const winstonLoggerTest =()=>{
    var sdkUtils = require('fabric-client/lib/utils');
    const winstonLogger = sdkUtils.getLogger("winston");
    const name = "name"
    winstonLogger.error('name? '+name+'a %s','string',{b:'B'},'c')
}

winstonLoggerTest()