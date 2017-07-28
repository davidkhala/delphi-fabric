#!/usr/bin/env bash

COMPANY='delphi' # must match to config_json
CHANNEL_ID="delphiChannel"

TLS_ENABLED=true
PEER_CONTAINER="BUContainerName.delphi.com"
./config/createChannel.sh $COMPANY $CHANNEL_ID $PEER_CONTAINER -s $TLS_ENABLED

./config/joinChannel.sh $COMPANY $CHANNEL_ID $PEER_CONTAINER -s $TLS_ENABLED