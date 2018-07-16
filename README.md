

Clone
------------------
_after first time clone this repository, submodule should be initialize_
```
$ cd <delphi-fabric>
$ git submodule update --init --recursive
```


Installation
-----------------------

 **Recommended OS** ubuntu 16.04

**Installation Script**
`$ ./install.sh`

----
 
**Requirements & dependencies**
  * fabric: 1.1.0 (for docker image, binary tool and fabric-sdk)
  * docker-ce 17.12.x-ce (API version 1.35)
  * golang 1.10 : align with docker version
  * node 8.10, npm 5.6 : npm install卡死的话，可以考虑添加淘宝的源
        - ``$ npm config set registry  https://registry.npm.taobao.org/``
  * java 1.8.0_151 (optional for java-sdk)
  * jq 1.5：a command line tool for parsing json format https://github.com/mikefarah/yq

-----

**Design idea**
 * use fabric-ca to generate all crypto material, instead of cryptogen
 * cluster: 
    - leader node provide 1. swarm config sharing server 'swarmServer' 2. signature server 'signServer'
    - master node provide signature server 'signServer', holding 1 CA, 1 orderer, 1 peer 
 * swarmServer:
    - Redis/Couchdb as DB
 * prefer to use config-less fabric-ca
 * use `npm dockerode` to run docker container & services, instead of `docker-compose` or `docker stack deploy` 

Major configuration
-----------------------
 we cluster most of the config in ``config/orgs.json``, enjoy!
 others:
  - swarm server: ``swarm/swarm.json``
  - Restfull app: ``app/config.json``
  - chaincodes path: ``config/chaincode.json``  

Test on single host
-----------------------
**steps**
1. run `$ ./docker.sh` to restart network
2. run `$ node app/testChannel.js` to create-channel and join-channel
3. `$ node app/testInstall.js` to install chaincode and instantiate chaincode
4. `$ node app/testInvoke.js` to invoke chaincode

Test on docker swarm
-----------------------
I have migrated codes in `cluster/managerNode` to new repository [Fabric-swarm-manager](https://github.com/davidkhala/fabric-swarm-manager)
`fabric-swarm-manager` is used on new managerNode machine `slave` to play with existing cluster
Current machine is noted as `master` 

**steps**
1. [master] run `$ ./docker-swarm.sh` to restart network
2. [master] run `$ node app/testChannel.js` to create-channel and join-channel
3. [slave] run `$./manager.sh` to prepare for it self
3. [master] `$ node app/testInstall.js` to install chaincode and instantiate chaincode
4. [master] `$ node app/testInvoke.js` to invoke chaincode

dep: to import third-party package in vendor folder
--------
  - dep could only be run under system $GOPATH, 
  - my sample chaincodes have been migrated to ``github.com/davidkhala/chaincode``


## Finished

- kafka on local & swarm
- use npm:js-yaml to write YAML files instead of jq
- thirdPartyTag for kafka, zookeeper, couchdb...
- swarm mode: network server to manage ip:hostname
- stress test in nodejs: Caliper
- update system channel ``testchainid``
- use golang/dep instead of govendor
- new orderer with same org
- make pm2 signServer, swarmServer also run in single mode
- fabric-ca CRUD user and identityService
## TODO
- TLS
- java sdk and docker-swarm: keep update
- endorsement policy config
- test backup and recover
- cooperate with official network_config.json
- chaincode version,ID string format
- javascript chaincode
- chaincode uninstall
- multiple priv-file creation is witnessed in app/cryptoKeyStore, investigate problem of state store, crypto-store
- change default keystore path: /home/david/.hfc-key-store/ still having files even when bootstrap
- adding kafka/zookeeper online
- stateStore problem
- docker version problem in ver. 18.x 
- can Organization name replaced by MSP name?
- pm2 to runConfigtxlator? without shell?
- use nodejs scripts to replace runConfigtxgen.sh
- move couchdb server to container based
- take care of docker swarm init --force-new-cluster
- using Atom for Mac default keymap, align with bret Harrison
- will block file name be a problem in signature cache? take care docker cp from container for multiple request
- to support couchdb ledger
- cross chaincode invoke on same channel and differed channel
- chaincode setEvent
- 1.2 not ready: eventHub failed to catch block
## New feature, patch required for node-sdk
 
- feature: implement configtx in node-sdk??
- patch: configtxgen binary allow upper case channelName
- fabric-ca: cannot change csr.cn via '--csr.cn=${container_name}' TLS CSR: {CN:example.com Names:[{C:US ST:North Carolina L: O:Hyperledger OU:Fabric SerialNumber:}] Hosts:[02cf209b65fb localhost] KeyRequest:<nil> CA:<nil> SerialNumber:}
 
## Abandoned tasks
- docker volume plugin

