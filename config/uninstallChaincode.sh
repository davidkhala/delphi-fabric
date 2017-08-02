#!/usr/bin/env bash

VERSION=$3 # "v0"
CHAINCODE_NAME=$2 # delphiChaincode
PEER_CONTAINER=$1 # BUContainerName.delphi.com

docker exec $PEER_CONTAINER rm -rf /var/hyperledger/production/chaincodes/$CHAINCODE_NAME.$VERSION
