#!/usr/bin/env bash

# require channel exist
# node ./app/testChannel.js

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
config_dir="$CURRENT/config"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"
CONFIG_JSON="$config_dir/orgs.json"
CONFIG_chaincode="$config_dir/chaincode.json"

COMPANY="delphi"
orgName="BU"
MSPID="BUMSP"
peerContainerName="BUContainer3"
peerPort="7091"     # map for 7051, random assign when empty
eventHubPort="7093" # map for 7053, random assign when empty

companyConfig=$(jq -r ".$COMPANY" $CONFIG_JSON)
COMPANY_DOMAIN=$(echo $companyConfig | jq -r ".domain")
TLS_ENABLED=$(echo $companyConfig | jq ".TLS")
dockerNetwork=$(echo $companyConfig | jq -r ".docker.network")
org_domain="$orgName.$COMPANY_DOMAIN"

# TODO use CA to generate MSP

peerDomainName="$peerContainerName.${org_domain}"
VERSION=$(echo $companyConfig | jq -r ".docker.fabricTag")
IMAGE_TAG="x86_64-$VERSION"
image=hyperledger/fabric-peer:$IMAGE_TAG

chaincode_args="[]"

chaincodeId='delphiChaincode'

chaincodePath=$(jq -r ".chaincodes.${chaincodeId}.path" $CONFIG_chaincode)

chaincodeVersion='v0'
#NOTE docker will auto prune dead chaincode container: timeout setting in CORE_CHAINCODE_DEPLOYTIMEOUT
chaincodeContainerPattern="dev-$peerDomainName-$chaincodeId-$chaincodeVersion"
newDir="${CRYPTO_CONFIG_DIR}peerOrganizations/$org_domain/peers/$peerDomainName"
function down() {
	if [ -n "$(docker ps -aq --filter name=$peerContainerName)" ]; then
		docker network disconnect $dockerNetwork $peerContainerName
		#docker container rm -f:  Force the removal of a running container (uses SIGKILL)
		docker container rm -f $peerContainerName
	fi
	if [ -n "$(docker ps -aq --filter name=$chaincodeContainerPattern)" ]; then
		docker container rm -f $chaincodeContainerPattern
	fi
	chaincodeImage=$(docker images | grep "${chaincodeContainerPattern,,}" | awk '{print($1)}')
	if [ -n "$chaincodeImage" ]; then
		docker image rm $chaincodeImage
	fi
}
function up() {

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

	node -e "require('./app/testJoinNewPeer.js').caGen('${peerContainerName}','${orgName}')"
	node app/testChannel.js
	docker run -d --name $peerContainerName \
		-e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
		-e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$dockerNetwork \
		-e CORE_LOGGING_LEVEL=DEBUG \
		-e CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true \
		-e CORE_PEER_GOSSIP_USELEADERELECTION=true \
		-e CORE_PEER_GOSSIP_ORGLEADER=false \
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
	docker network connect --alias $peerDomainName $dockerNetwork $peerContainerName
	# set peerPort if it is auto-gen
	peerPort=$(./common/docker/utils/docker.sh viewContainerPort $peerContainerName 7051)
	eventHubPort=$(./common/docker/utils/docker.sh viewContainerPort $peerContainerName 7053)

	tlscaCRT=$newDir/tls/ca.crt

	node -e "require('./app/testJoinNewPeer.js').joinChannel('${peerPort}','${eventHubPort}', '${tlscaCRT}','${peerDomainName}','${orgName}')"
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
