Delphi-fabric
---------------------

Installation
-----------------------

 **Recommended OS** ubuntu 16.04

**Installation Script**
1. `$ ./install.sh gitSync`   
_after first time clone this repository, submodule should be initialize_
2. `$ ./install.sh`

- (optional) PM2 command line manager can be installed by  
    `$ ./install.sh PM2CLI`

----
 
**Requirements & dependencies**
  * fabric: 1.4.0 (for docker image, binary tool and fabric-sdk)
  * docker-ce 18.x
  * golang 1.11 
  * node 8.10, npm 5.6 : npm install卡死的话，可以考虑添加淘宝的源
        - ``$ npm config set registry  https://registry.npm.taobao.org/``
  * java 1.8.0_151 (optional for java-sdk)
  * jq 1.5：a command line tool for parsing json format https://github.com/mikefarah/yq

-----

**Design idea**
 * use fabric-ca to generate all crypto material, instead of cryptogen
 * prefer to use config-less fabric-ca
 * use `npm dockerode` to run docker container & services, instead of `docker-compose` or `docker stack deploy` 

Major configuration
-----------------------
 we cluster most of the config in ``config/orgs.json``, enjoy!
 others:
  - chaincodes path: ``config/chaincode.json``
  - sample chaincodes ``github.com/davidkhala/chaincode``  

Test on single host
-----------------------
 * run `$ ./docker.sh` to restart network


Finished
-----------------------
- use npm:js-yaml to write YAML files instead of jq
- update system channel ``testchainid``
- new orderer with same org
- fabric-ca CRUD user and identityService
- chaincode version,ID string RegX
- chaincode language support: nodeJS, golang
- Fixed security leakage: priv-file, crypto-store in .hfc-key-store
- chaincode setEvent support
- hybrid data storage model: couchdb, leveldb 
- use dep to import fabric source into vendor
- peer, orderer backup and instant recover: "stateVolume": "Documents/backupVolumes/orderer/",
- nodejs scripts work as runConfigtxgen.sh to wrap binaries

## TODO
- TLS, java sdk: keep update
- java chaincode
- chaincode uninstall
- pm2 to runConfigtxlator? without shell?
- 1.3: idemixgen
- migrate from kafka to etcdRaft 
- migrate to use make file instead of ./install.sh (https://www.gnu.org/software/make/manual/make.html#Introduction)
- chaincode "Indy": a fabric chaincode implementation of all claimed features of Hyperledger/indy
- Suggestion from Paul: Question: are your repos more to do with Fabric itself, rather than pure Fabric developer resources (ie go/js/java/typescript chaincode/sdk work)? (I'm only concentrating on Fabric Developer resources in particular) If so - I would suggest to contact someone like Silona Bonewald to find a suitable home/new page on Confluence for that? I'm just asking where its 'natural' home is 🙂 Also I would suggest the README explains 1) what it is 2) what it does (as a goal of 'studying Fabric' resources) 3) what the consumer would get from trying it out or hope to achieve?


 
## New feature, patch required for node-sdk
 
- feature: implement configtx in node-sdk??
- patch: configtxgen binary allow upper case channelName
- fabric-ca: cannot change csr.cn via '--csr.cn=${container_name}' TLS CSR: {CN:example.com Names:[{C:US ST:North Carolina L: O:Hyperledger OU:Fabric SerialNumber:}] Hosts:[02cf209b65fb localhost] KeyRequest:<nil> CA:<nil> SerialNumber:}
 
## Abandoned tasks
- docker volume plugin
- endorsement policy config: too flexible to build template
- docker swarm deployment
- cooperate with official network_config.json
- adding kafka/zookeeper online: use etcdRaft

