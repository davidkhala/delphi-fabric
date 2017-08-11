#!/usr/bin/env bash


CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
CONFIG_JSON="$CURRENT/config/orgs.json"
CHAINCODE_CONFIG="$CURRENT/config/chaincode.json"
CRYPTO_CONFIG_DIR="$CURRENT/config/crypto-config"

CleanInstall=true
TLS_ENABLED=true
COMPANY='delphi'

GOPATH="$CURRENT/GOPATH/"
# write GOPATH to chaincode config
jq ".GOPATH=\"$GOPATH\"" $CHAINCODE_CONFIG | sponge $CHAINCODE_CONFIG
sudo chmod -R 777 $CRYPTO_CONFIG_DIR
cd config/node-sdk

CHAINCODE_NAME="adminChaincode"

CHAINCODE_PATH=$(jq -r ".chaincodes.${CHAINCODE_NAME}.path" $CHAINCODE_CONFIG)
cd -

# grpcs://localhost:7051
Localhost="localhost"
GRPC_PROTOCAL="grpcs://"
if [ $TLS_ENABLED = false ]; then
    GRPC_PROTOCAL="grpc://"
fi

for orgName in $(jq -r ".chaincodes.${CHAINCODE_NAME}.orgs|keys[]" $CHAINCODE_CONFIG);do


    org_json=$(jq -r ".chaincodes.${CHAINCODE_NAME}.orgs.${orgName}" $CHAINCODE_CONFIG)
# NOTE URLs: redundant, for test only
#URLs=[]
containerNames=[]
for peerContainerName in $(echo $org_json | jq -r ".peers[].containerName");do
    # NOTE redundant or for test only
    port=$(jq -r ".$COMPANY.orgs.${orgName}.peers[]|select(.containerName==\"${peerContainerName}\").portMap[]|select(.container==7051).host" $CONFIG_JSON)

#    URLs=$(echo $URLs | jq ". |=.+[\"${GRPC_PROTOCAL}${Localhost}:${port}\"]")
    containerNames=$(echo $containerNames | jq ". |=.+[\"${peerContainerName}\"]")
    if [ $CleanInstall = true ]; then
        COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
        ./config/uninstallChaincode.sh $peerContainerName.$COMPANY_DOMAIN $CHAINCODE_NAME "v0"
# NOTE chaincode update is OK
#        ./config/uninstallChaincode.sh $peerContainerName.$COMPANY_DOMAIN $CHAINCODE_NAME "v1"
    fi

done

node app/testInstall.js "$containerNames" $CHAINCODE_NAME $CHAINCODE_PATH $orgName -v "v0"

# NOTE chaincode update is OK
#node app/testInstall.js "$containerNames" $CHAINCODE_NAME $CHAINCODE_PATH $orgName -v "v1"

done


node app/testInstantiate.js $CHAINCODE_NAME


node app/testInvoke.js $CHAINCODE_NAME



#  Promise is rejected: Error: Failed to deserialize creator identity, err Expected MSP ID PMMSP, received BUMSP
#  ==> installChaincode urls should be in same org in one request


