#!/usr/bin/env bash


CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
CONFIG_JSON="$CURRENT/config/orgs.json"
CHAINCODE_CONFIG="$CURRENT/config/chaincode.json"
CRYPTO_CONFIG_DIR="$CURRENT/config/crypto-config"
network_config_json_output="$CURRENT/config/node-sdk/test.json"

CleanInstall=true
TLS_ENABLED=true
COMPANY='delphi'

sudo chmod -R 777 $CRYPTO_CONFIG_DIR
cd config/node-sdk
node network-config-gen.js $COMPANY -c $CRYPTO_CONFIG_DIR -o $network_config_json_output

CHAINCODE_NAME="delphiChaincode"

CHAINCODE_PATH=$(jq -r ".chaincodes.${CHAINCODE_NAME}.path" $CHAINCODE_CONFIG)
cd -

# grpcs://localhost:7051
Localhost="localhost"
GRPC_PROTOCAL="grpcs://"
VERSION=$(jq -r ".chaincodes.$CHAINCODE_NAME.version" $CHAINCODE_CONFIG)
if [ $TLS_ENABLED = false ]; then
    GRPC_PROTOCAL="grpc://"
fi

for orgName in $(jq -r ".chaincodes.${CHAINCODE_NAME}.orgs|keys[]" $CHAINCODE_CONFIG);do


    org_json=$(jq -r ".chaincodes.${CHAINCODE_NAME}.orgs.${orgName}" $CHAINCODE_CONFIG)
URLs=[]
for peerContainerName in $(echo $org_json | jq -r ".peers[].containerName");do
    port=$(jq -r ".$COMPANY.orgs.${orgName}.peers[]|select(.containerName==\"${peerContainerName}\").portMap[]|select(.container==7051).host" $CONFIG_JSON)
    URLs=$(echo $URLs | jq ". |=.+[\"${GRPC_PROTOCAL}${Localhost}:${port}\"]")

    if [ $CleanInstall = true ]; then
        COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
        ./config/uninstallChaincode.sh $peerContainerName.$COMPANY_DOMAIN $CHAINCODE_NAME $VERSION
    fi

done
node app/test.js "$URLs" $CHAINCODE_NAME $CHAINCODE_PATH $orgName -v $VERSION

# NOTE chaincode update is OK
node app/test.js "$URLs" $CHAINCODE_NAME $CHAINCODE_PATH $orgName -v "v1"

done





#  Promise is rejected: Error: Failed to deserialize creator identity, err Expected MSP ID PMMSP, received BUMSP
#  ==> installChaincode urls should be in same org in one request


