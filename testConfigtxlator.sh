#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
CONFIG_JSON="$CURRENT/config/orgs.json"
for ((i = 1; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
to_restart=false
COMPANY="delphi"
CHANNEL_NAME='delphiChannel'
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

BLOCK_FILE=$CURRENT/config/delphi.new.block

BLOCK_JSON_FILE=$CURRENT/config/delphi.new.block.json

#TODO passed, next to do pass it to peer channel bin
container_createChannel_Dir=$(jq -r ".$COMPANY.channels.$CHANNEL_NAME.containerPath_createChannel_Dir" $CONFIG_JSON)
# FIXME failed: orderContainerName.delphi.com    | 2017-08-18 08:19:19.324 UTC [orderer/common/broadcast] Handle -> WARN bfb Rejecting CONFIG_UPDATE because: Error authorizing update: Update not for correct channel:  for delphichannel
function bootstrapExample(){
    local config_dir="$CURRENT/config"
    PEER_CONTAINER=cli.delphi.com # TODO using cli for testing

    ./config/fetchChannel.sh $COMPANY $CHANNEL_NAME $PEER_CONTAINER config -o $container_createChannel_Dir/fetch_block.pb

    docker cp $PEER_CONTAINER:$container_createChannel_Dir/fetch_block.pb fetch_block.pb

    curl -X POST --data-binary @fetch_block.pb http://127.0.0.1:7059/protolator/decode/common.Block > genesis.json
    jq .data.data[0].payload.data.config genesis.json > config.json   #取到json文件里的某字段内容
    jq ".channel_group.groups.Orderer.values.BatchSize.value.max_message_count = 30" config.json  > updated_config.json   #更新数据并导出到updated_config.json

    curl -X POST --data-binary @config.json http://127.0.0.1:7059/protolator/encode/common.Config > config.pb #序列化config文件

    curl -X POST --data-binary @updated_config.json http://127.0.0.1:7059/protolator/encode/common.Config > updated_config.pb #序列化更新的文件

    curl -X POST -F original=@config.pb -F updated=@updated_config.pb http://127.0.0.1:7059/configtxlator/compute/update-from-configs>update_request.pb

    # NOTE directly using update_request.pb as peer channel update input will prompt:
    #    Error: Invalid channel create transaction : bad header
    curl -X POST --data-binary @update_request.pb http://127.0.0.1:7059/protolator/decode/common.ConfigUpdate > update_request.json
    echo '{"payload":{"header":{"channel_header":{"channel_id":"'${CHANNEL_NAME,,}'", "type":2}},"data":{"config_update":'$(cat update_request.json)'}}}' > config_update_as_envelope.json
    curl -X POST --data-binary @config_update_as_envelope.json http://127.0.0.1:7059/protolator/encode/common.Envelope > config_update_as_envelope.pb
    echo [debug]container_createChannel_Dir $container_createChannel_Dir
    docker cp config_update_as_envelope.pb $PEER_CONTAINER:$container_createChannel_Dir/config_update_as_envelope.pb



    ./config/updateChannel.sh $COMPANY $CHANNEL_NAME $PEER_CONTAINER $container_createChannel_Dir/config_update_as_envelope.pb



}
bootstrapExample

function testRecover() {
	local BLOCK_FILE=$1
	local CHANNEL_NAME=$(./common/bin-manage/configtxgen/runConfigtxgen.sh block view $BLOCK_FILE | grep "channel" | awk '{print $4}')
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

	# NOTE golang source
	# func fieldConfigProto(fieldName string, r *http.Request) (*cb.Config, error) {
	#	fieldBytes, err := fieldBytes(fieldName, r)
	#	if err != nil {
	#		return nil, fmt.Errorf("error reading field bytes: %s", err)
	#	}
	#
	#	config := &cb.Config{}
	#	err = proto.Unmarshal(fieldBytes, config)
	#	if err != nil {
	#		return nil, fmt.Errorf("error unmarshaling field bytes: %s", err)
	#	}
	#
	#	return config, nil
	#}
}

# testRecover $old_block_file testchainid  # TODO Error with field 'original': error unmarshaling field bytes: proto: bad wiretype for field common.Config.Sequence: got wiretype 2, want 0

# testDiff not passed
function testDiff() {
	:
	# diff config
	# FIXME: original=delphi.block and updated=delphi.new.block: Error with field 'original': error unmarshaling field bytes: proto: bad wiretype for field common.Config.Sequence: got wiretype 2, want 0
	# curl -X POST  -F channel=$CHANNEL_NAME -F original=@"$BLOCK_FILE" -F updated=@"$BLOCK_FILE_recover" http://127.0.0.1:7059/configtxlator/compute/update-from-configs
}

