#!/usr/bin/env bash

# require channel exist
# node ./app/testChannel.js

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
config_dir="$CURRENT/config"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"
CRYPTO_UPDATE_CONFIG="$config_dir/crypto-config-update.yaml"
CONFIG_JSON="$config_dir/orgs.json"
CONFIG_chaincode="$config_dir/chaincode.json"


orgName="AM"
MSPName="${orgName}MSPName"
MSPID="${orgName}MSP"
peerContainerName="AMContainerName"
peerPort="7071"     # map for 7051, random assign when empty
eventHubPort="7073" # map for 7053, random assign when empty

companyConfig=$(jq "." $CONFIG_JSON)
COMPANY_DOMAIN=$(echo $companyConfig | jq -r ".domain")
TLS_ENABLED=$(echo $companyConfig | jq ".TLS")
dockerNetworkName=$(echo $companyConfig | jq -r ".docker.network")
org_domain="$orgName.$COMPANY_DOMAIN"
newDir="${CRYPTO_CONFIG_DIR}peerOrganizations/$org_domain"
peerCount=1
userCount=0

i=0
peerDomainName="peer$i.${org_domain}"
VERSION=$(echo $companyConfig | jq -r ".docker.fabricTag")
IMAGE_TAG="x86_64-$VERSION"
image=hyperledger/fabric-peer:$IMAGE_TAG
adminUserMspDir="$newDir/users/Admin@$org_domain/msp"

chaincode_args="[]"

chaincodeId='delphiChaincode'

chaincodePath=$(jq -r ".chaincodes.${chaincodeId}.path" $CONFIG_chaincode)

chaincodeVersion='v0'
#NOTE docker will auto prune dead chaincode container: timeout setting in CORE_CHAINCODE_DEPLOYTIMEOUT
chaincodeContainerPattern="dev-$peerDomainName-$chaincodeId-$chaincodeVersion"
function down() {
	if [ -n "$(docker ps -aq --filter name=$peerContainerName)" ]; then
		docker network disconnect $dockerNetworkName $peerContainerName
		#docker container rm -f:  Force the removal of a running container (uses SIGKILL)
		docker container rm -f $peerContainerName
	fi
	./common/bin-manage/configtxlator/runConfigtxlator.sh down
	if [ -n "$(docker ps -aq --filter name=$chaincodeContainerPattern)" ]; then
		docker container rm -f $chaincodeContainerPattern
	fi
	rm -rf $newDir
	chaincodeImage=$(docker images | grep "${chaincodeContainerPattern,,}" | awk '{print($1)}')
	if [ -n "$chaincodeImage" ]; then
		docker image rm $chaincodeImage
	fi
}
function up() {
    node -e "require('./config/crypto-config.js').newOrg({
    Name:'${orgName}',
    Domain:'${orgName}.${COMPANY_DOMAIN}',
    CRYPTO_UPDATE_CONFIG:'${CRYPTO_UPDATE_CONFIG}'
    })"
	# TODO use fabric-ca for key generate
	./common/bin-manage/cryptogen/runCryptogen.sh -i $CRYPTO_UPDATE_CONFIG -o $CRYPTO_CONFIG_DIR -a

	CMD="peer node start"

	CRYPTO_CONFIG_CONTAINER_DIR="/etc/hyperledger/crypto-config"
	TLS_ENV=""
	if [ "$TLS_ENABLED" == "true" ]; then
		TLS_ENV="-e CORE_PEER_TLS_KEY_FILE=$CRYPTO_CONFIG_CONTAINER_DIR/peerOrganizations/$org_domain/peers/$peerDomainName/tls/server.key
		 -e CORE_PEER_TLS_CERT_FILE=$CRYPTO_CONFIG_CONTAINER_DIR/peerOrganizations/$org_domain/peers/$peerDomainName/tls/server.crt
		 -e CORE_PEER_TLS_ROOTCERT_FILE=$CRYPTO_CONFIG_CONTAINER_DIR/peerOrganizations/$org_domain/peers/$peerDomainName/tls/ca.crt "
	fi
	# NOTE CORE_PEER_GOSSIP_ORGLEADER=false => err MSP AMMSP is unknown
	# CORE_PEER_GOSSIP_USELEADERELECTION=true => Error: Endpoint read failed
	# -e CORE_PEER_NETWORKID=$corePeerNetworkId: take care image "dev" cleaning

	docker run -d --name $peerContainerName \
		-e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
		-e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$dockerNetworkName \
		-e CORE_LOGGING_LEVEL=DEBUG \
		-e CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true \
		-e CORE_PEER_GOSSIP_USELEADERELECTION=false \
		-e CORE_PEER_GOSSIP_ORGLEADER=true \
		-e CORE_PEER_GOSSIP_EXTERNALENDPOINT=$peerContainerName:7051 \
		-e CORE_PEER_LOCALMSPID=$MSPID \
		-e CORE_PEER_MSPCONFIGPATH=$CRYPTO_CONFIG_CONTAINER_DIR/peerOrganizations/$org_domain/peers/$peerDomainName/msp \
		-e CORE_PEER_TLS_ENABLED=$TLS_ENABLED \
		$TLS_ENV \
		-e CORE_PEER_ID=$peerDomainName \
		-e CORE_PEER_ADDRESS=$peerDomainName:7051 \
		-p $peerPort:7051 \
		-p $eventHubPort:7053 \
		--volume /run/docker.sock:/host/var/run/docker.sock \
		--volume $CRYPTO_CONFIG_DIR:$CRYPTO_CONFIG_CONTAINER_DIR \
		$image $CMD
	#NOTE docker network connect --alias => to fix: Error trying to connect to local peer: context deadline exceeded
	docker network connect --alias $peerDomainName $dockerNetworkName $peerContainerName
	./common/bin-manage/configtxlator/runConfigtxlator.sh start
	# set peerPort if it is auto-gen
	peerPort=$(./common/docker/utils/docker.sh viewContainerPort $peerContainerName 7051)
	eventHubPort=$(./common/docker/utils/docker.sh viewContainerPort $peerContainerName 7053)
	node -e "require('./app/testConfigtxlator.js').addOrg('${orgName}', '${MSPName}', '${MSPID}', 'BUMSPName', '${adminUserMspDir}', '${org_domain}','${peerPort}','${eventHubPort}','${peerDomainName}'
    ,'${chaincodePath}','${chaincodeId}','${chaincodeVersion}','${chaincode_args}')"
#    addOrg TypeError: Cannot read property 'MSP' of undefined
#    at getMspID (/home/davidliu/Documents/delphi-fabric/app/helper.js:158:35)
#    at Object.mspCreate (/home/davidliu/Documents/delphi-fabric/app/helper.js:197:60)
#    at Object.create (/home/davidliu/Documents/delphi-fabric/app/helper.js:292:23)
#    at objects.user.admin.get.then.user (/home/davidliu/Documents/delphi-fabric/app/helper.js:296:29)

}

if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi

chaincodeContainerID=$(docker ps -aq --filter name=$chaincodeContainerPattern)

# TODO save config back to config Files?
