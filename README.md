# delphi-fabric


Clone
------------------
_after first time clone this repository, submodule should be initialize_
```
$ cd <delphi-fabric>
$ git submodule update --init --recursive
```


Installation
-----------------------

 **推荐环境** ubuntu 16.04：安装脚本和大部分代码目前只在这个版本系统中测试过; The only tested OS and version for ``install.sh`` and almost all program.

**安装脚本**
`$ ./install.sh`

> **墙内网络的问题**
在墙内由于npm 包安装都很慢，因而时常会出现运行安装脚本到一般卡死的情况。
If any problem found when running ``install.sh``, like hanging in ``npm install``, it is recommended to install manually for each requirement
----
 以下是依赖的版本列表，遇到问题可以自行寻找安装源
  **Requirements**
   * fabric: 1.1.0-alpha (for docker image, binary tool and fabric-sdk)
   * docker-ce 17.12.0-ce (API version 1.35)
   * golang 1.9.2 : align with docker version
   * node 8.10, npm 5.6 : npm install卡死的话，可以考虑添加淘宝的源
        - ``$ npm config set registry  https://registry.npm.taobao.org/``
   * java 1.8.0_151 (测试java-sdk用)
   * jq 1.5：一个用命令行解析json的工具 https://stedolan.github.io/jq/

-----




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
1. run `$ ./testLocal.sh`
    - it includes
        1. update fabric binary files 
        2. update npm fabric-ca-client, npm fabric-client 
        3. update golang chaincode 

2. run `$ ./docker.sh` to clean and restart network

3. run `$ node app/testChannel.js` to create-channel and join-channel
4. `$ node app/testInstall.js` to install chaincode and instantiate chaincode
5. `$ node app/testInvoke.js` to invoke chaincode

channel update 
-----------------------
TODO: refactoring

test Swarm mode
-----------------------

TODO:refactoring


### CA service
TODO


govendor: to import third-party package in vendor folder
--------
  - govendor could only be run under system $GOPATH, then the location of chaincode cannot be arbitrary again
  - my sample chaincodes have been migrated to ``github.com/davidkhala/chaincode``


## Finished

- kafka on local
- use npm:js-yaml to write YAML files instead of https://github.com/mikefarah/yq
- chaincode upgrade will not reset data
- thirdPartyTag for kafka, zookeeper, couchdb...
- service constraints node.role==master will not work since leader will change when current leader corrupted
- swarm mode : network server to manage ip:hostname
- stress test in nodejs: Caliper
- remove global domain
- not to use docker-compose and docker stack deploy to run docker services on swarm, use npm dockerode 
- kafka on swarm
- CA in command base is preferred


## TODO
- TLS
- java sdk and docker-swarm: keep update
- endorsement policy config
- test backup and recover
- cooperate with official network_config.json
- chaincode version string format
- javascript chaincode
- chaincode uninstall
- use path.resolve to replace `${path}/filename`
- function new() -> classify
- ?update system channel ``testchainid``
- there is a trend to use golang/dep instead of govendor https://gerrit.hyperledger.org/r/#/c/19113/
- multiple priv-file creation is witnessed in app/cryptoKeyStore, investigate problem of state store, crypto-store
- use relative path via ``const os = require('os');console.log(os.homedir());``
- refactor: to use pathUtil.CryptoPath class instead of peer_hostname_full
- change default keystore path: /home/david/.hfc-key-store/ still having files even when bootstrap
- simplify portMap design from [{7051:port}] to {port: port,eventHubPort:port2}
- adding kafka/zookeeper online
- stateStore problem
- user server design instead of nfs
- docker version problem in ver. 18.x 
- slave node in swarm should use another code repository.
- to avoid port conflict, use Redis as implement of swarmServer

### TODO master slave design
- slave: each org has 1 ca, then 1 orderer,1 peer
- master & slave: signature server 
- master: signature collector 

## New feature, patch required for node-sdk
 
- feature: implement configtx in node-sdk??
- patch: configtxgen binary allow upper case channelName
- fabric-ca: cannot change csr.cn via '--csr.cn=${container_name}' TLS CSR: {CN:example.com Names:[{C:US ST:North Carolina L: O:Hyperledger OU:Fabric SerialNumber:}] Hosts:[02cf209b65fb localhost] KeyRequest:<nil> CA:<nil> SerialNumber:}
 
## Abandoned tasks
- docker volume plugin
