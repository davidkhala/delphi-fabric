#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
MSPROOT=$(jq -r ".docker.volumes.MSPROOT.dir" $CONFIG_JSON)
companyConfig=$(jq "." $CONFIG_JSON)
channelsConfig=$(echo $companyConfig | jq ".channels")
CONFIGTX_DIR=$(jq -r ".docker.volumes.CONFIGTX.dir" $CONFIG_JSON)
mkdir -p $CONFIGTX_DIR

VERSION=$(echo $companyConfig | jq -r ".docker.fabricTag")
IMAGE_TAG="x86_64-$VERSION"
TLS_ENABLED=$(echo $companyConfig | jq ".TLS")

## update bin first
$CURRENT/common/bin-manage/pullBIN.sh -v $VERSION
if npm list fabric-client@$VERSION --depth=0; then : # --depth=0 => list only top level modules
else
	npm install fabric-client@$VERSION --save --save-exact
fi
if npm list fabric-ca-client@$VERSION --depth=0; then :
else
	npm install fabric-ca-client@$VERSION --save --save-exact
fi

node -e "require('./config/crypto-config.js').gen({})"
$CURRENT/common/bin-manage/cryptogen/runCryptogen.sh -i "$CRYPTO_CONFIG_FILE" -o "$MSPROOT"

# NOTE IMPORTANT for node-sdk: clean stateDBcacheDir, otherwise cached crypto material will leads to Bad request:
# TODO more subtle control to do in nodejs
nodeAppConfigJson="$CURRENT/app/config.json"
stateDBCacheDir=$(jq -r '.stateDBCacheDir' $nodeAppConfigJson)
rm -rf $stateDBCacheDir
echo clear stateDBCacheDir $stateDBCacheDir

BLOCK_FILE=$(echo $companyConfig | jq -r ".orderer.genesis_block.file")
PROFILE_BLOCK=$(echo $companyConfig | jq -r ".orderer.genesis_block.profile")
node -e "require('./config/configtx.js').gen({MSPROOT:'${MSPROOT}',PROFILE_BLOCK:'${PROFILE_BLOCK}'})"

./common/bin-manage/configtxgen/runConfigtxgen.sh block create "$CONFIGTX_DIR/$BLOCK_FILE" -p $PROFILE_BLOCK -i $config_dir

channelNames=$(echo $channelsConfig | jq -r "keys[]")
for channelName in $channelNames; do
	channelConfig=$(echo $channelsConfig | jq ".${channelName}")
	channelFilename=$(echo $channelConfig | jq -r ".file")
	channelFile="$CONFIGTX_DIR/$channelFilename"
	./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $channelFile -p $channelName -i $config_dir -c ${channelName,,}
	#NOTE Capital char in Channel name is not supported  [channel: delphiChannel] Rejecting broadcast of config message from 172.18.0.1:36954 because of error: initializing configtx manager failed: Bad channel id: channel ID 'delphiChannel' contains illegal characters
done
go get -u "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json
