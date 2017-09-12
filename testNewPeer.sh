#!/usr/bin/env bash

# require channel exist
# node ./app/testChannel.js

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
config_dir="$CURRENT/config"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"
CRYPTO_UPDATE_CONFIG="$config_dir/crypto-config-update.yaml"
CONFIG_JSON="$config_dir/orgs.json"

COMPANY="delphi"
orgName="AM"
MSPName="${orgName}MSPName"
MSPID="${orgName}MSP"
peerContainerName="AMContainerName"
peerPort="7071"     # map for 7051, random assign when empty
eventHubPort="7073" # map for 7053, random assign when empty
# NOTE docker query port: $ docker container port AMContainerName 7051/tcp | awk '{split($0,a,":"); print a[2]}'

COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
dockerNetworkName=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)
org_domain="${orgName,,}.$COMPANY_DOMAIN"

i=0
peerDomainName="peer$i.${org_domain}"
>$CRYPTO_UPDATE_CONFIG
yaml w -i $CRYPTO_UPDATE_CONFIG PeerOrgs[$i].Name $orgName
yaml w -i $CRYPTO_UPDATE_CONFIG PeerOrgs[$i].Domain "${orgName,,}.$COMPANY_DOMAIN"

peerCount=1
userCount=0
yaml w -i $CRYPTO_UPDATE_CONFIG PeerOrgs[$i].Template.Count $peerCount
yaml w -i $CRYPTO_UPDATE_CONFIG PeerOrgs[$i].Template.Start 0
yaml w -i $CRYPTO_UPDATE_CONFIG PeerOrgs[$i].Users.Count $userCount

newDir="${CRYPTO_CONFIG_DIR}peerOrganizations/$org_domain"
rm -rf $newDir
# TODO use fabric-ca for key generate
./common/bin-manage/cryptogen/runCryptogen.sh -i $CRYPTO_UPDATE_CONFIG -o $CRYPTO_CONFIG_DIR -a

VERSION=$(jq -r ".$COMPANY.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"
image=hyperledger/fabric-peer:$IMAGE_TAG

CMD="peer node start"

docker stop $peerContainerName
docker rm $peerContainerName # TODO restart
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
	-e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto-config/peerOrganizations/$org_domain/users/Admin@$org_domain/msp \
	-e CORE_PEER_TLS_ENABLED=true \
	-e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/crypto-config/peerOrganizations/$org_domain/peers/$peerDomainName/tls/server.key \
	-e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/$org_domain/peers/$peerDomainName/tls/server.crt \
	-e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/crypto-config/peerOrganizations/$org_domain/peers/$peerDomainName/tls/ca.crt \
	-e CORE_PEER_ID=$peerDomainName \
	-e CORE_PEER_ADDRESS=$peerDomainName:7051 \
	-p $peerPort:7051 \
	-p $eventHubPort:7053 \
	--volume /var/run/:/host/var/run/ \
	--volume $CRYPTO_CONFIG_DIR:/etc/hyperledger/crypto-config \
	$image $CMD
#NOTE docker network connect --alias => to fix: Error trying to connect to local peer: context deadline exceeded
docker network connect --alias $peerDomainName $dockerNetworkName $peerContainerName

./common/bin-manage/configtxlator/runConfigtxlator.sh start

# set peerPort if it is auto-gen
peerPort=$(./common/docker/utils/docker.sh view container port $peerContainerName 7051)
eventHubPort=$(./common/docker/utils/docker.sh view container port $peerContainerName 7053)
adminUserMspDir="$newDir/users/Admin@$org_domain/msp"

chaincode_args="[]"

chaincodePath='github.com/delphi'
chaincodeId='delphiChaincode'

chaincodeVersion='v0'
node -e "require('./app/testConfigtxlator.js').addOrg('${orgName}', '${MSPName}', '${MSPID}', 'BUMSPName', '${adminUserMspDir}', '${org_domain}','${peerPort}','${eventHubPort}','${peerDomainName}'
    ,'${chaincodePath}','${chaincodeId}','${chaincodeVersion}','${chaincode_args}')"

#NOTE docker will auto prune dead chaincode container: timeout setting in CORE_CHAINCODE_DEPLOYTIMEOUT
chaincodeContainerPattern="dev-$peerDomainName-$chaincodeId-$chaincodeVersion"
chaincodeContainerID=$(docker ps -aq --filter name=$chaincodeContainerPattern)
chaincodeImage=$(docker images | grep "${chaincodeContainerPattern,,}" | awk '{print($1)}')

# TODO save config back to config Files?
rm $CRYPTO_UPDATE_CONFIG
