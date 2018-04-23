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
在墙内由于docker-compose，yaml工具，npm 包安装都很慢，因而时常会出现运行安装脚本到一般卡死的情况。
If any problem found when running ``install.sh``, like hanging in ``npm install``, it is recommended to install manually for each requirement
----
 以下是依赖的版本列表，遇到问题可以自行寻找安装源
  **Requirements**
   * fabric: 1.1.0-alpha (for docker image, binary tool and fabric-sdk)
   * docker-ce 17.12.0-ce (API version 1.35)
   * docker-compose 1.14.0
   * golang 1.9.2 : align with docker version
   * node 8.10, npm 5.6 : npm install卡死的话，可以考虑添加淘宝的源
        - ``$ npm config set registry  https://registry.npm.taobao.org/``
   * java 1.8.0_151 (测试java-sdk用)
   * jq 1.5：一个用命令行解析json的工具 https://stedolan.github.io/jq/
   * moreutils 0.57-1 : 工具集，ubuntu或类似系统专用。我们用到其中sponge工具，用于结合jq 将pipeline里面的内容inline更新到源文件里

-----




Major configuration
-----------------------
 we cluster most of the config in ``config/orgs.json``, enjoy!

Test on single host
-----------------------
**steps**
1. run `$ ./testLocal.sh`
    - it includes
        1. load others config from orgs.json
        2. npm fabric-* updating
        3. generate crypto-config file(default crypto-config.yaml)
        4. run 'cryptogen' binary to generate crypto-materials
        5. generate channel, block config file (default configtx.yaml)
        6. run 'configtxgen' to generate channel, block file
        7. generate docker-compose.yaml

2. in another terminal, run `$ ./docker.sh` to clean and restart network


3. Then come back to previous terminal running testLocal.sh
  run `$ node app/testChannel.js`
  to create-channel and join-channel
4. `$ node app/testInstall.js` to install chaincode and instantiate chaincode
5. `$ node app/testInvoke.js` to invoke chaincode

channel update (single host mode)
-----------------------
__Description:__
- assume we have already channel named 'delphiChannel' with 2 orgs 'BU', 'PM'
- we want to create a new docker container named 'AMContainerName' belonging to a new org 'AM'
- the new peer should work as other existing peers, supporting all chaincode action like instantiate, invoke, etc.
- org 'AM' should be added to 'delphiChannel' config as a 'online update'(not to re-create current channel).

__Steps:__


1. run first 3 steps of `testing on single host'
    ```
    terminal 1:$ ./testLocal.sh
    ...
    terminal 2:$ ./docker.sh
    ...
    terminal 1:$ node app/testChannel.js

    ```
2. run:
    ```
    terminal 1 $ ./testNewOrg.sh
    ```

test Swarm mode
-----------------------

assume we have two physical machine, take ip `192.168.0.167` as *leader*, ip `192.168.0.144` as *manager*

1. Prepare: swarm configuration service server(SCSS)
  - SCSS is used to monitoring cluster status(ip,hostname), docker-swarm join-token,docker volume path to share and other global information.

        > SCSS using couchdb as state persistent mechanism.
        To install couchdb on your target machine run:
        ```$ ./install.sh couchdb```
  - Fauxton is installed along with couchdb as admin portal. [http://localhost:5984/_utils/]
          make sure to setting "Main Config" -- "chttpd" -- "bind_address" ==> 0.0.0.0
  - run SCSS: ``node ./swarm/swarmServer.js`` in a new terminal
2. if you have run through above 'single host test', you should clean your environment before start. For example, run `$ ./docker.sh down`
3. on *leader*, run `$ cluster/leaderNode/install.sh`
4. on *leader*, run `$ cluster/leaderNode/prepare.sh 192.168.0.167`
      > parameter *192.168.0.167* work as `advertiseAddr` in docker swarm
5. on *manager*, run `$ cluster/managerNode/install.sh` and then `$ cluster/managerNode/prepare.sh`
6. health-check swarm across nodes(1 node means 1 physical machine),
    (if there is network problem, 'nmap' is a recommended network probing tools:`apt install nmap`)

 - On both *leader* and *manager*, check if joining swarm success by `docker node ls` (*means current node)
    > ID                            HOSTNAME               STATUS              AVAILABILITY        MANAGER STATUS
    > lhpmolwzw60dclsjmr4suufno *   ubuntu                   Ready               Active              Leader
    > tatl890bgusrzww4x5w1ktvjk     fabric-swarm-manager                Ready               Active              Reachable
7. on *leader* run ./testSwarm.sh
    it includes:
     - re-create crypto material and block file
     - re-create local docker volume
     - generate compose-file for swarm
8. on *leader* run ./docker-swarm.sh to deploy service
9. run `$ node app/testChannel.js` to create-channel and join-channel
10. `$ node app/testInstall.js` to install chaincode and instantiate chaincode
11. `$ node app/testInvoke.js` to invoke chaincode


### CA service
Seemingly certificate and keystore generated from 'cryptogen' cannot mutual authenticate with those generated by CA service

Currently we can **only support invoke chaincode with new user identity created by CA**.

test invoke chaincode by user identity
-----------------------

**steps**

0. enable ca in config
 make sure in ``config/orgs.json``:``.orgs.${orgName}.ca.enable`` is true.
 here we chose ``BU`` as the orgName

1. run steps 1-4 in section **test on single host**
2. run `$ node app/testNewUserInvoke`
  _For TLS version please update to version above ``1.1.0-preview``_


test to run an intermediate CA
----------------------------
 **Scene**
  * __rootCA__: ``BUTLSCA``
    * I found that when enrolling intermediate CA identity,
    the ``tls.certfile`` and ``tls.keyfile`` of ``BUTLSCA`` should be set to the non-tls set of keypair
    like ``ca.BU.Delphi.com-cert.pem`` and its private key, otherwise we will encounter X509 problem. This might be a system-size dilemma of using 'tlsca' or 'ca' as issue prefix
  * __intermediate CA identity__: ``cityU``
    * only registration of ``cityU`` is required. The enroll process will be automated inside container
  * __docker run__: npm dockerode
    * Finally, I take a chance to use npm module dockerode for manipulate docker via nodejs. it seems workable but require more callback handle codes.
    * The container name will be ``ca.${intermediateName=cityU}.${org_domain=BU.Delphi.com}``

 **Steps**
 0. run steps 1-2 in section **test on single host**
 1. run ``node app/testIntermediateCA.js`` (TODO detach mode is under development, if you found no response in the terminal, Ctrl+C and check running state by ``docker ps`` and ``docker logs ca.cityU.BU.Delphi.com`` )

govendor: to import third-party package in vendor folder
--------
  - govendor could only be run under system $GOPATH, then the location of chaincode cannot be arbitrary again
  - my sample chaincodes have been migrated to ``github.com/davidkhala/chaincode``


## Finished

- kafka on local
- use npm:js-yaml to write YAML files instead of https://github.com/mikefarah/yq
- chaincode upgrade will not reset data
- thirdPartyTag for kafka, zookeeper, couchdb...
## TODO
- java sdk and docker-swarm: keep update
- endorsement policy config
- test backup and recover
- kafka on swarm: migrate orderer first
- cooperate with official network_config.json
- chaincode version string format
- javascript chaincode
- chaincode uninstall
- use path.resolve to replace `${path}/filename`
- docker volume plugin
- current design: local volume will not be clean in docker.down
- swarm mode : network server to manage ip:hostname and deploy constraints
- stress test in nodejs
- function new() -> classify
- ?update system channel ``testchainid``
- there is a trend to use golang/dep instead of govendor https://gerrit.hyperledger.org/r/#/c/19113/
- Bug design: since multiple priv-file creation is witnessed, investigate problem of state store, crypto-store
- how about each org has 1 orderer,1 peer and 1 ca before the previous 2
- migrates to use dockerode in everywhere and clean up existing dockerode code
- why files in app/cryptoKeyStore keeping generated
- use relative path via ``const os = require('os');console.log(os.homedir());``
- refactor: to use pathUtil.CryptoPath class
- change default keystore path: [Error: EACCES: permission denied, open '/home/david/.hfc-key-store/05669e8b1597befecc99049b7b5797d992ab51c6c669a57fd1bcd76974a83324-priv']
- simplify portMap design from [{7051:port}] to {port: port,eventHubPort:port2}
- signature server for both leader node and manager nodes