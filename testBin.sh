#!/usr/bin/env bash

sudo apt -qq install -y moreutils
sudo apt-get -qq install -y jq
# run cryptogen
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
remain_params=""
for ((i = 1; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"

COMPANY='delphi' # must match to config_json
# write to config: jq do not support in-place editing, use moreutils:sponge
CONFIGTX_OUTPUT_DIR="$config_dir/configtx"
mkdir -p $CONFIGTX_OUTPUT_DIR

BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
CHANNEL_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.channel"

PROFILE_BLOCK=${COMPANY}Genesis
PROFILE_CHANNEL=${COMPANY}Channel
CHANNEL_NAME="delphiChannel"
VERSION="1.0.1"
jq ".$COMPANY.docker.fabricTag=\"$VERSION\"" $CONFIG_JSON | sponge $CONFIG_JSON
IMAGE_TAG="x86_64-$VERSION"
TLS_ENABLED=true

## update bin first
./common/bin-manage/pullBIN.sh -v $VERSION
if npm list fabric-client@$VERSION --depth=0; then : # --depth=0 => list only top level modules
else
	npm install fabric-client@$VERSION --save --save-exact
fi
if npm list fabric-ca-client@$VERSION --depth=0; then :
else
	npm install fabric-ca-client@$VERSION --save --save-exact
fi

./config/crypto-config-gen-go.sh $COMPANY -i $CRYPTO_CONFIG_FILE
./common/bin-manage/cryptogen/runCryptogen.sh -i "$CRYPTO_CONFIG_FILE" -o "$CRYPTO_CONFIG_DIR"

# NOTE IMPORTANT for node-sdk: clean stateDBcacheDir, otherwise cached crypto material will leads to Bad request:
# TODO more subtle control to do in nodejs
nodeAppConfigJson="$CURRENT/app/config.json"
stateDBCacheDir=$(jq -r '.stateDBCacheDir' $nodeAppConfigJson)
rm -rf $stateDBCacheDir
echo clear stateDBCacheDir $stateDBCacheDir

./config/configtx-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR -i $configtx_file -b $PROFILE_BLOCK -c $PROFILE_CHANNEL

./common/bin-manage/configtxgen/runConfigtxgen.sh block create $BLOCK_FILE -p $PROFILE_BLOCK -i $config_dir
./common/bin-manage/configtxgen/runConfigtxgen.sh block view $BLOCK_FILE -v -p $PROFILE_BLOCK -i $config_dir

./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $CHANNEL_FILE -p $PROFILE_CHANNEL -i $config_dir -c ${CHANNEL_NAME,,}
./common/bin-manage/configtxgen/runConfigtxgen.sh channel view $CHANNEL_FILE -v -p $PROFILE_CHANNEL -i $config_dir

COMPOSE_FILE="$config_dir/docker-compose.yaml"

if [ -f "$COMPOSE_FILE" ]; then
	./docker.sh down
fi
./config/compose-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -f $COMPOSE_FILE -s $TLS_ENABLED -v $IMAGE_TAG

# docker-compose -f $COMPOSE_FILE up
