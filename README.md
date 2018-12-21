
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
  * fabric: 1.3.0 (for docker image, binary tool and fabric-sdk)
  * docker-ce 18.x
  * golang 1.10 
  * node 8.10, npm 5.6 : npm install卡死的话，可以考虑添加淘宝的源
        - ``$ npm config set registry  https://registry.npm.taobao.org/``
  * java 1.8.0_151 (optional for java-sdk)
  * jq 1.5：a command line tool for parsing json format https://github.com/mikefarah/yq

-----

**Design idea**
 * use fabric-ca to generate all crypto material, instead of cryptogen
 * cluster: 
    - [master] node provide 
        1. [pm2] swarm config sharing server 'swarmServer'
            - state storage db: Redis/Couchdb
        2. [pm2] signature server 'signServer'
        3. [container] 1 CA for each orderer org, 1 CA for each peer org 
    - [slave] node provide 
        1. [pm2] signature server 'signServer'
        2. [container] 1 CA for peer org, 1 peer, 1 CA for orderer org(experimental) 
 * prefer to use config-less fabric-ca
 * use `npm dockerode` to run docker container & services, instead of `docker-compose` or `docker stack deploy` 

Major configuration
-----------------------
 we cluster most of the config in ``config/orgs.json``, enjoy!
 others:
  - swarm server: ``swarm/swarm.json``
  - chaincodes path: ``config/chaincode.json``
  - my sample chaincodes have been migrated to ``github.com/davidkhala/chaincode``  

Test on single host
-----------------------
 * run `$ ./docker.sh` to restart network

Test on docker swarm
-----------------------
I have migrated codes in `cluster/managerNode` to new repository [Fabric-swarm-manager](https://github.com/davidkhala/fabric-swarm-manager)

`fabric-swarm-manager` is used on new managerNode machine `slave` to play with existing cluster

Current machine is noted as `master` 

**steps**
1. [master] run `$ ./docker-swarm.sh` to restart network and prepare channel
2. [slave] run `$ ./manager.sh` to prepare own ca and peer, join exist channel and install chaincode
3. [master] run `$ ./docker-swarm.sh chaincode` to install and instantiate chaincode
4. [slave] run `$ node invokeChaincode.js` to invoke chaincode

Finished
-----------------------
- kafka on local & swarm
- use npm:js-yaml to write YAML files instead of jq
- swarm mode: network server to manage ip:hostname
- update system channel ``testchainid``
- new orderer with same org
- make pm2 signServer, swarmServer also run in single mode
- fabric-ca CRUD user and identityService
- chaincode version,ID string format
- nodeJS chaincode
- Duplicated priv-file creation, crypto-store problem in .hfc-key-store
- chaincode setEvent: for both golang,nodejs chaincodeType
- 1.2 private data (sideDB), solved by manually set anchor peers
- it is allowed that chaincode invoker, target peers belongs to differed organization.
- hybrid data storage model: couchdb, leveldb 
- use dep to import fabric source into vendor
## TODO
- TLS, java sdk and docker-swarm: keep update
- java chaincode
- test backup and recover
- cooperate with official network_config.json
- chaincode uninstall
- adding kafka/zookeeper online
- docker version problem in ver. 18.x 
- pm2 to runConfigtxlator? without shell?
- use nodejs scripts to replace runConfigtxgen.sh
- 1.3: idemixgen
- take care of docker swarm init --force-new-cluster
- will block file name be a problem in signature cache? take care docker cp from container for multiple request
- migrate to use make file instead of ./install.sh
- chaincode partial update: not all peers upgrade to latest chaincode, is it possible that old chaincode still work
    with inappropriate endorsement config
- Refactor chaincode upgrade: use version standard "0.0.0", unify instantiate and upgrade  
## New feature, patch required for node-sdk
 
- feature: implement configtx in node-sdk??
- patch: configtxgen binary allow upper case channelName
- fabric-ca: cannot change csr.cn via '--csr.cn=${container_name}' TLS CSR: {CN:example.com Names:[{C:US ST:North Carolina L: O:Hyperledger OU:Fabric SerialNumber:}] Hosts:[02cf209b65fb localhost] KeyRequest:<nil> CA:<nil> SerialNumber:}
 
## Abandoned tasks
- docker volume plugin
- endorsement policy config: too flexible to build template