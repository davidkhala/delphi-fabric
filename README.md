# delphi-fabric

### test work flow:

1. testBin.sh
    - it includes
        1. set some config in codes, mostly about file and directory path
        2. load others config from orgs.json
        3. npm fabric-* updating
        4. generate crypto-config file(default crypto-config.yaml)
        5. run 'cryptogen' binary to generate crypto-materials
        6. generate channel, block config file (default configtx.yaml)
        7. run 'configtxgen' to generate channel, block file

2. in another terminal, run /config/docker.sh, or run docker-compose up manually     
 docker-compose up -d is not recommended, since it will print logs not to this terminal.
    
3. Then come back to previous terminal running testBin.sh run ./testChannel.sh
...
4. ./testChaincode.sh
...

