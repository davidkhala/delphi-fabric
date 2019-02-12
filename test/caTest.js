// [[{"code":0,"message":"The CN 'david.repeat(20)@Merchant' exceeds the maximum character limit of 64"}]]

const helper = require('../app/helper');
const org = helper.randomOrg('peer');
const swarm = false;
require('../config/caCryptoGen').genUser({userName:'david'.repeat(5)}, org, swarm);
