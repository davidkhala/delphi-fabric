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
peerPort="" # map for 7051, random assign when empty
eventHubPort="" # map for 7053, random assign when empty
# NOTE docker query port: $ docker container port AMContainerName 7051/tcp | awk '{split($0,a,":"); print a[2]}'



COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
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

./common/bin-manage/cryptogen/runCryptogen.sh -i $CRYPTO_UPDATE_CONFIG -o $CRYPTO_CONFIG_DIR -a

VERSION="1.0.0"
IMAGE_TAG="x86_64-$VERSION"
image=hyperledger/fabric-peer:$IMAGE_TAG

CMD="peer node start"

docker stop $peerContainerName
docker rm $peerContainerName # TODO restart
docker run -d --name $peerContainerName \
    -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
	-e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=config_default \  # TODO
	-e CORE_LOGGING_LEVEL=DEBUG \
	-e CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true \
	-e CORE_PEER_GOSSIP_USELEADERELECTION=true \
	-e CORE_PEER_GOSSIP_ORGLEADER=false \
	-e CORE_PEER_GOSSIP_SKIPHANDSHAKE=true \
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



./common/bin-manage/configtxlator/runConfigtxlator.sh start

adminUserMspDir=${CRYPTO_CONFIG_DIR}peerOrganizations/$org_domain/users/Admin@$org_domain/msp
node -e "require('./app/testConfigtxlator.js').addOrg('${orgName}', '${MSPName}', '${MSPID}', 'BUMSPName', '${adminUserMspDir}', '${org_domain}')"
# TODO set peerPort if it is auto-gen
# TODO save config back to config Files?
sleep 5
rm $CRYPTO_UPDATE_CONFIG
