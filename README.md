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
   * node 6.12.3, npm 3.10.10: npm install卡死的话，可以考虑添加淘宝的源 
        - ``$ npm config set registry  https://registry.npm.taobao.org/``
   * java 1.8.0_151 (测试java-sdk用)
   * jq 1.5.1：一个用命令行解析json的工具 https://stedolan.github.io/jq/
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
assume we have two physical machine,with main hostName 'ubuntu' with ip `192.168.0.167`,'fabric-swarm-manager' with ip `192.168.0.144`  
0. Prepare:  
    1. if you have run through above 'single host test', you should clean your environment before start. For example, run `$ ./docker.sh down`
    2. on 'ubuntu', run `$ cluster/leaderNode/install.sh` and then `$ cluster/leaderNode/prepare.sh`
    3. on 'fabric-swarm-manager', run `$ cluster/managerNode/install.sh` and then `$ cluster/managerNode/prepare.sh`
1. build up swarm across nodes(1 node means 1 physical machine),   
    my solution is
    
 - On 'ubuntu',run 'docker swarm init'(if you have multiple network adapter, option `--advertise-addr 192.168.0.167` is needed for specify which ip is used to identify this machine)
   
 - On 'ubuntu', run 'docker swarm join-token manager' to print a message like
 >To add a manager to this swarm, run the following command:  
 >     docker swarm join --token SWMTKN-1-3vgv9jebyhdqzid9o5zcyufeciahegbew7mtbfykfpjfk73jbn-e4p28p30jxv1eu5o2lcvcaa2d 192.168.0.167:2377
 - On 'fabric-swarm-manager', run above printed message `docker swarm join --token SWMTKN-1-3vgv9jebyhdqzid9o5zcyufeciahegbew7mtbfykfpjfk73jbn-e4p28p30jxv1eu5o2lcvcaa2d 192.168.0.167:2377` to join swarm  
    (if there is network problem, 'nmap' is a recommended network probing tools:`apt install nmap`)
 - On 'ubuntu' or 'fabric-swarm-manager', check if joining swarm success by `docker node ls` (*means current node)
 > ID                            HOSTNAME               STATUS              AVAILABILITY        MANAGER STATUS  
 > lhpmolwzw60dclsjmr4suufno *   ubuntu                   Ready               Active              Leader
 > tatl890bgusrzww4x5w1ktvjk     fabric-swarm-manager                Ready               Active              Reachable
2. run ./testSwarm.sh   
    it includes:
     - addLabels to node 'ubuntu' as a metadata of NFS shared path
     - generate compose-file for swarm
3. run ./docker-swarm.sh to deploy service   
    TODO: I will optimize this later about preparing and cleaning of swarm             
4.   run `$ node app/testChannel.js`
     to create-channel and join-channel 
5. `$ node app/testInstall.js` to install chaincode and instantiate chaincode
6. `$ node app/testInvoke.js` to invoke chaincode        
 
 
### CA service
Seemingly certificate and keystore generated from 'cryptogen' cannot mutual authenticate with those generated by CA service 

Currently we can **only support invoke chaincode with new user identity created by CA**. 

test invoke chaincode by user identity 
-----------------------

**steps**

0. enable ca in config  
 make sure in ``config/orgs.json``:``.delphi.orgs.${orgName}.ca.enable`` is true.  
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
  


    
## TODO
- java sdk and docker-swarm: keep update
- endorsement policy config
- test backup and recover
- kafka
- cooperate with official network_config.json 
- refactor: use npm:js-yaml to write more nodejs, less linux 
- chaincode version string format
- chaincode uninstall
- use path.resolve to replace `${path}/filename`
- /common/docker/install.sh ::suDocker problem: gpasswd -a $USER docker <The user object here is 'root' when sudo, not the original 'david'>
- swarm mode : network server to manage ip:hostname and deploy constraints
- stress test in nodejs
- test: whether chaincode upgrade will reset data?
- function new() -> classify