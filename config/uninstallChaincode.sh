#!/usr/bin/env bash

VERSION=$3 # "v0"
CHAINCODE_NAME=$2 # delphiChaincode
PEER_CONTAINER=$1 # BUContainerName

docker exec $PEER_CONTAINER rm -rf /var/hyperledger/production/chaincodes/$CHAINCODE_NAME.$VERSION
# TODO but chaincode still exist in state db after intantiate