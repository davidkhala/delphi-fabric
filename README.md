Delphi-fabric
---------------------

**This project is not relevant to delphi program language**

![](./delphi-fabric.png)

This project aims to provide a user-friendly fabric application development toolset including
- fabric network simulation (alternative of **Build your first network**)
- chaincode lifecycle tools
- adopt stateless fashion when using multiple fabric-sdk, to power fabric *proxy server* second-development     
- as a major integration testing environment for [fabric-common](https://github.com/davidkhala/fabric-common), which is 
a pure helper to fabric-sdk user.


Why
-----------------------
- No multiple config file confusing anymore. All magic in `orgs.json` and `chaincode.json`  
    - no crypto-config.yaml
    - no docker-compose.yaml
    - auto-generated and managed configtx.yaml and genesis blocks for each channel. 
    - named docker volume to avoid infinite file path hell
- No need to copy and paste to have a proper connection profile from existing network. Now you are simulation your own network
- No need to global find all appearance of `org1` and replace it with `orgA`, organization names and mspid are put together
- Forget to cleanup legacy configs after you restart your network? 
    It is impossible here thanks to our carefully tested cleaning-up process
- Production-level and long run maintenance
    - This project is the research facility of a active blockchain product
- Perfect same crypto-material file structure as you use `cryptogen`. We have place fabric-ca response in good manner.

Features
-----------------------
- use fabric-ca to generate all crypto material, instead of cryptogen
- use config-less fabric-ca
- use `npm dockerode` to run docker container with comprehensive JSON configuration file, instead of `docker-compose` on yaml file
- JSON config cater for both application and network structure (superset of connection profile and network-yaml)
- channel update support
- chaincode language support
   - nodeJS
   - golang
- Fixed security leakage (wallet remaining) on development machine: priv-file, crypto-store in .hfc-key-store
- support hybrid data storage model (couchdb|leveldb), you could specify it for each peer
- update anchor peers as a normal channel config instead of using `configtx`
- use npm:js-yaml to read|write YAML files instead of jq 

Major configuration
-----------------------
 - we cluster network and channel config in ``config/orgs.json``, enjoy!
 - chaincodes configurations: ``config/chaincode.json``
 
 [sample chaincode source](https://github.com/davidkhala/chaincode)

Installation
-----------------------


**Installation Script**
1. `$ ./install.sh gitSync`   
_after first time clone this repository, submodule should be initialize_
2. `$ ./install.sh`

----
 
**Requirements & dependencies**
  *  **Compatible OS** 
    - ubuntu xenial/bionic
    - [TODO] MacOS 
  * [Fabric](./common/README.md#Prerequisite)

Test on single host
-----------------------
 * run `$ ./docker.sh` to restart network


Finished
-----------------------
- use npm:js-yaml to write YAML files instead of jq
- new orderer with same org
- chaincode version,ID string RegX
- hybrid data storage model: couchdb, leveldb

 
## Abandoned tasks
- docker volume plugin
- docker swarm deployment
- cooperate with official network_config.json
- [grafana](https://github.com/grafana/grafana)
