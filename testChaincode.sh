#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
CONFIG_JSON="$CURRENT/config/orgs.json"
CHAINCODE_CONFIG_FILE="$CURRENT/config/chaincode.json"
CRYPTO_CONFIG_DIR="$CURRENT/config/crypto-config"
CleanInstall=true
TLS_ENABLED=true
COMPANY='delphi'
globalChannelsConfig=$(jq ".$COMPANY.channels" $CONFIG_JSON)

GOPATH="$CURRENT/GOPATH/"
# write GOPATH to chaincode config
jq ".GOPATH=\"$GOPATH\"" $CHAINCODE_CONFIG_FILE | sponge $CHAINCODE_CONFIG_FILE
sudo chmod -R 777 $CRYPTO_CONFIG_DIR

CHAINCODE_NAME="adminChaincode"

chaincodeConfig=$(jq ".chaincodes.${CHAINCODE_NAME}" $CHAINCODE_CONFIG_FILE)
CHAINCODE_PATH=$(echo $chaincodeConfig | jq -r ".path")

# grpcs://localhost:7051
Localhost="localhost"
GRPC_PROTOCAL="grpcs://"
if [ $TLS_ENABLED = false ]; then
	GRPC_PROTOCAL="grpc://"
fi

targetChannels=$(echo $chaincodeConfig | jq -r ".target_channels|keys[]")


for channelName in $targetChannels; do

	orgsInChannel=$(echo $globalChannelsConfig | jq ".${channelName,,}.orgs")
	for orgName in $(echo $orgsInChannel | jq -r "keys[]"); do
	    peerContainerNamesJSONARRAY_eachOrg=[]
		peerIndexes=$(echo $orgsInChannel | jq ".${orgName}.peerIndexes[]")
		for peerIndex in $peerIndexes; do
			peerConfig=$(jq ".$COMPANY.orgs.$orgName.peers[$peerIndex]" $CONFIG_JSON)
			peerContainerName=$(echo $peerConfig | jq -r ".containerName")
			port=$(echo $peerConfig | jq -r ".portMap[]|select(.container==7051).host")
			if [ $CleanInstall = true ]; then
				COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
				./config/uninstallChaincode.sh $peerContainerName.$COMPANY_DOMAIN $CHAINCODE_NAME "v0"
				# NOTE chaincode update is OK
				#        ./config/uninstallChaincode.sh $peerContainerName.$COMPANY_DOMAIN $CHAINCODE_NAME "v1"
			fi

			peerContainerNamesJSONARRAY_eachOrg=$(echo $peerContainerNamesJSONARRAY_eachOrg | jq ". |=.+[\"${peerContainerName}\"]")
		done

        node app/testInstall.js "$peerContainerNamesJSONARRAY_eachOrg" $CHAINCODE_NAME $CHAINCODE_PATH $orgName -v "v0"
	done

done



# NOTE chaincode update is OK
#node app/testInstall.js "$containerNames" $CHAINCODE_NAME $CHAINCODE_PATH $orgName -v "v1"

node app/testInstantiate.js $CHAINCODE_NAME BU BUContainerName -r

node app/testInvoke.js $CHAINCODE_NAME

#  Promise is rejected: Error: Failed to deserialize creator identity, err Expected MSP ID PMMSP, received BUMSP
#  ==> installChaincode urls should be in same org in one request
