#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

BLOCK_FILE_NEW="$CURRENT/config/delphi.new.block"
COMPANY='delphi' # must match to config_json
CHANNEL_NAME="delphiChannel"
CONFIG_JSON="$CURRENT/config/orgs.json"
TLS_ENABLED=true
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
# join partially tested OK

for peerObj in $(jq -c ".$COMPANY.channels.$CHANNEL_NAME.orgs | to_entries[]" $CONFIG_JSON);do
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



./config/createChannel.sh $COMPANY $CHANNEL_NAME $peerContainer0 -s $TLS_ENABLED -v $BLOCK_FILE_NEW

# TODO assuming all joining peers are using same channel/block file output dir
container_createChannel_Dir=$(jq -r ".$COMPANY.channels.$CHANNEL_NAME.containerPath_createChannel_Dir" $CONFIG_JSON)
echo ===start join channel "for $peerContainerNames"
for peerContainerName in $peerContainerNames; do

    PEER_CONTAINER="$peerContainerName.$COMPANY_DOMAIN"

    CONTAINER_BLOCK_FILE=$container_createChannel_Dir/${CHANNEL_NAME,,}.block
    docker cp $BLOCK_FILE_NEW $PEER_CONTAINER:$CONTAINER_BLOCK_FILE
    ./config/joinChannel.sh $COMPANY $CONTAINER_BLOCK_FILE $PEER_CONTAINER

done
