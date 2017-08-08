#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

BLOCK_FILE_NEW="$CURRENT/config/delphi.new.block"
COMPANY='delphi' # must match to config_json
CHANNEL_ID="delphiChannel"
CONFIG_JSON="$CURRENT/config/orgs.json"
TLS_ENABLED=true
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
# join partially tested OK

for peerObj in $(jq -c ".$COMPANY.channels.${CHANNEL_ID,,}.orgs | to_entries[]" $CONFIG_JSON);do
    echo [debug] peerObj $peerObj
    orgName=$(echo $peerObj | jq -r ".key")
    peerIndexes=$(echo $peerObj | jq -r ".value.peerIndexes[]")
    for peerIndex in $peerIndexes
    do
        peerContainerName=$(jq -r ".$COMPANY.orgs.$orgName.peers[$peerIndex].containerName" $CONFIG_JSON)
        peerContainerNames+=" $peerContainerName"
    done

done

function getSampleContainer(){
    echo "$1".$COMPANY_DOMAIN
}
peerContainer0=$(getSampleContainer $peerContainerNames)



./config/createChannel.sh $COMPANY $CHANNEL_ID $peerContainer0 -s $TLS_ENABLED -v $BLOCK_FILE_NEW

for peerContainerName in $peerContainerNames; do

    PEER_CONTAINER="$peerContainerName.$COMPANY_DOMAIN"
    echo loop peer container: $PEER_CONTAINER
    docker cp $BLOCK_FILE_NEW $PEER_CONTAINER:/opt/gopath/src/github.com/hyperledger/fabric/peer/${CHANNEL_ID,,}.block
    ./config/joinChannel.sh $COMPANY $CHANNEL_ID $PEER_CONTAINER

done
