# delphi-fabric

### test work flow:

1. run `$ ./testBin.sh`
    - it includes
        1. set some config in codes, mostly about file and directory path
        2. load others config from orgs.json
        3. npm fabric-* updating
        4. generate crypto-config file(default crypto-config.yaml)
        5. run 'cryptogen' binary to generate crypto-materials
        6. generate channel, block config file (default configtx.yaml)
        7. run 'configtxgen' to generate channel, block file

2. in another terminal, run `$ ./docker.sh` to clean and restart network      
 
    
3. Then come back to previous terminal running testBin.sh   
  run `$ node app/testChannel.js`
  to create-channel and join-channel 
4. `$ node app/testInstall.js` to install chaincode and instantiate chaincode
5. `$ node app/testInvoke.js` to invoke chaincode


## TODO
- ca-service in node-sdk
- TLS disabled testing
- docker swarm for multi-machine deploy
- endorsement policy config

