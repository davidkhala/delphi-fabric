
Installation
-----------------------

 **Recommended OS** ubuntu 16.04

**Installation Script**
1. `$ ./install.sh gitSync`   
_after first time clone this repository, submodule should be initialize_
2. `$ ./install.sh`
3. `$ ./common/docker/dockerSUDO.sh` 
this script help to make docker command runnable without `sudo` prefix

- PM2 command line manager can be installed by  
    `$ ./install.sh PM2CLI`

----
 
**Requirements & dependencies**
  * fabric: 1.2.0 (for docker image, binary tool and fabric-sdk)
  * docker-ce 17.12.x-ce (API version 1.35)
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
        1. [pm2] swarm config sharing server `swarmServer`
            - state storage db: Redis/Couchdb
        2. [pm2] signature server `signServer`
        3. [container] 1 CA for each orderer org, 1 CA for each peer org 
    - [slave] node provide 
        1. [pm2] signature server `signServer`
        2. [container] 1 CA for peer org, 1 peer, 1 CA for orderer org(experimental) 
 * prefer to use config-less fabric-ca
 * use `npm dockerode` to run docker container & services, instead of `docker-compose` or `docker stack deploy` 

Major configuration
-----------------------
 we cluster most of the config in ``config/orgs.json``, enjoy!
 others:
  - swarm server: ``swarm/swarm.json``
  - chaincodes path: ``config/chaincode.json``  

Test on single host
-----------------------
**steps**
 * run `$ ./docker.sh` to restart network
 * `$ node app/testInvoke.js` to invoke chaincode (default to loop infinitely)

Test on docker swarm
-----------------------
I have migrated codes in `cluster/managerNode` to new repository [Fabric-swarm-manager](https://github.com/davidkhala/fabric-swarm-manager)

`fabric-swarm-manager` is used on new managerNode machine `slave` to play with existing cluster

Current machine is noted as `master` 

**steps**
1. [master] run `$ ./docker-swarm.sh` to restart network and prepare channel, install and instantiate chaincode
2. [slave] run `$./manager.sh` to prepare for it self
4. [master] `$ node app/testInvoke.js` to invoke chaincode

TODO dep: to import third-party package in vendor folder
--------
  - dep could only be run under system $GOPATH, 
  - my sample chaincodes have been migrated to ``github.com/davidkhala/chaincode``


## Attention
- nodejs chaincode take longer time in install chaincode only.


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
- chaincode version,ID string format
- nodeJS chaincode
- Duplicated priv-file creation, crypto-store problem in .hfc-key-store
- chaincode setEvent: for both golang,nodejs chaincodeType
- replace Organization name by MSP name
- 1.2 private channel data, solved by manually set anchor peers
## TODO
- TLS, java sdk and docker-swarm: keep update
- test backup and recover
- cooperate with official network_config.json
- chaincode uninstall
- adding kafka/zookeeper online
- docker version problem in ver. 18.x 
- pm2 to runConfigtxlator? without shell?
- use nodejs scripts to replace runConfigtxgen.sh
- move couchdb server to container based, and support couchdb ledger
- take care of docker swarm init --force-new-cluster
- will block file name be a problem in signature cache? take care docker cp from container for multiple request
- cross chaincode invoke on same channel and differed channel
- migrate to use make file instead of ./install.sh
- use dep to import fabric source into vendor
## New feature, patch required for node-sdk
 
- feature: implement configtx in node-sdk??
- patch: configtxgen binary allow upper case channelName
- fabric-ca: cannot change csr.cn via '--csr.cn=${container_name}' TLS CSR: {CN:example.com Names:[{C:US ST:North Carolina L: O:Hyperledger OU:Fabric SerialNumber:}] Hosts:[02cf209b65fb localhost] KeyRequest:<nil> CA:<nil> SerialNumber:}
- fabric-ca: `fabric-ca` line in git ignore make source copy failed
- fabric-sdk-node: add timeStamp for default winston logger 
## Abandoned tasks
- docker volume plugin
- using Atom for Mac default keymap, align with bret Harrison
- endorsement policy config: too flexible to build template