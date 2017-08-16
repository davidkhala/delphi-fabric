#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
for ((i = 1; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
to_restart=false
COMPANY="delphi"
CHANNEL_NAME='delphichannel'
PEER_CONTAINER="BUContainerName.delphi.com"
while getopts "r" shortname $remain_params; do
	case $shortname in
	r)
		echo "set restart flag"
		to_restart=true
		;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done

entry=$(sudo netstat -pa | grep "configtxlator")

if [ -z "$entry" ]; then
	echo Not found, to start
	./common/bin/configtxlator version
	./common/bin/configtxlator start &

else
	PID=$(echo $entry | awk '{print $7}' | awk -F/ '{print $1}')
	echo An instance of configtxlator is running...PID: $PID
	if [ $to_restart == "true" ]; then
		echo "to restart"
		kill -9 $PID
		./common/bin/configtxlator version
		./common/bin/configtxlator start &
		sleep 1
	else
		echo "to continue"
	fi
fi

old_block_file=$CURRENT/config/configtx/delphi.block
oldChannelName=$(./common/bin-manage/configtxgen/runConfigtxgen.sh block view $old_block_file | grep "channel"| awk '{print $4}')

BLOCK_FILE=$CURRENT/config/delphi.new.block

BLOCK_JSON_FILE=$CURRENT/config/delphi.new.block.json

function testRecover(){
    local BLOCK_FILE=$1
    local CHANNEL_NAME=$(./common/bin-manage/configtxgen/runConfigtxgen.sh block view $BLOCK_FILE | grep "channel"| awk '{print $4}')
    echo ===channel name in $BLOCK_FILE == $CHANNEL_NAME

    local channelOpt=""
    if [ ! -z $CHANNEL_NAME ]; then
        channelOpt=" -F channel=$CHANNEL_NAME"
    fi
    local BLOCK_FILE_recover="$BLOCK_FILE.recover"
    local BLOCK_FILE_decoded="$BLOCK_FILE.decoded.json"
    # decode to json
    curl -X POST --data-binary @"$BLOCK_FILE" http://127.0.0.1:7059/protolator/decode/common.Block >"$BLOCK_FILE_decoded"

    # encode to binary, the result is not exactly identical to orginal, json order problem
    curl -X POST --data-binary @"$BLOCK_FILE_decoded" http://127.0.0.1:7059/protolator/encode/common.Block >"$BLOCK_FILE_recover"


    # diff config
    # FIXME: original=delphi.block and updated=delphi.new.block: Error with field 'original': error unmarshaling field bytes: proto: bad wiretype for field common.Config.Sequence: got wiretype 2, want 0
    curl -X POST $channelOpt -F original=@"$BLOCK_FILE" -F updated=@"$BLOCK_FILE_recover" http://127.0.0.1:7059/configtxlator/compute/update-from-configs
}

# testRecover $old_block_file testchainid  # TODO Error with field 'original': error unmarshaling field bytes: proto: bad wiretype for field common.Config.Sequence: got wiretype 2, want 0


testRecover $old_block_file


# testDiff not passed
function testDiff(){
:
# diff config
# FIXME: original=delphi.block and updated=delphi.new.block: Error with field 'original': error unmarshaling field bytes: proto: bad wiretype for field common.Config.Sequence: got wiretype 2, want 0
# curl -X POST  -F channel=$CHANNEL_NAME -F original=@"$BLOCK_FILE" -F updated=@"$BLOCK_FILE_recover" http://127.0.0.1:7059/configtxlator/compute/update-from-configs
}

function updateExample(){
# fixme Error: proto: can't skip unknown wire type 6 for common.Envelope
# update example: update batch size
export MAXBATCHSIZEPATH=".data.data[0].payload.data.config.channel_group.groups.Orderer.values.BatchSize.value.max_message_count"
jq "$MAXBATCHSIZEPATH" $BLOCK_JSON_FILE # display current
jq "$MAXBATCHSIZEPATH = 20" $BLOCK_JSON_FILE | sponge $BLOCK_JSON_FILE

curl -X POST --data-binary @"$BLOCK_JSON_FILE" http://127.0.0.1:7059/protolator/encode/common.Block >$BLOCK_FILE

./config/fetchChannel.sh $COMPANY $CHANNEL_NAME $PEER_CONTAINER config

local_fetchOutput=$CURRENT/config/configtx/fetchOutput
fetchOutputConfigJson=$CURRENT/config/configtx/fetchOutput.json
curl -X POST --data-binary @"$local_fetchOutput" http://127.0.0.1:7059/protolator/decode/common.Block > $fetchOutputConfigJson

tempJson="temp.json"

fetchOutputConfigJsonUpdate=$CURRENT/config/configtx/fetchOutput.update.json
jq .data.data[0].payload.data.config $fetchOutputConfigJson >$tempJson

jq ".channel_group.groups.Orderer.values.BatchSize.value.max_message_count = 30" $tempJson  > $fetchOutputConfigJsonUpdate

# TODO no intergration from here
curl -X POST --data-binary @"$fetchOutputConfigJson" http://127.0.0.1:7059/protolator/encode/common.Config > config.pb

curl -X POST --data-binary @"$fetchOutputConfigJsonUpdate" http://127.0.0.1:7059/protolator/encode/common.Config > updated_config.pb

curl -X POST -F original=@config.pb -F updated=@updated_config.pb http://127.0.0.1:7059/configtxlator/compute/update-from-configs -F channel=$CHANNEL_NAME > config_update.pb

curl -X POST --data-binary @config_update.pb http://127.0.0.1:7059/protolator/decode/common.ConfigUpdate > config_update.json
echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL_NAME'", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' > config_update_as_envelope.json


CONTAINER_updateEnvelopFile="/etc/hyperledger/configtx/config_update_as_envelope.pb"
local_updateEnvelopFile="$CURRENT/config/configtx/config_update_as_envelope.pb"
curl -X POST --data-binary @config_update_as_envelope.json http://127.0.0.1:7059/protolator/encode/common.Envelope >$local_updateEnvelopFile

# TODO peer channel update -f config_update_as_envelope.pb -c testchainid -o 127.0.0.1:7050
sleep 1
./config/updateChannel.sh $COMPANY $CHANNEL_NAME $PEER_CONTAINER $CONTAINER_updateEnvelopFile



}

