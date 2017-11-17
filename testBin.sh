#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"

COMPANY='delphi' # must match to config_json
companyConfig=$(jq ".$COMPANY" $CONFIG_JSON)
channelsConfig=$(echo $companyConfig | jq ".channels")
CONFIGTX_OUTPUT_DIR="$config_dir/configtx"
mkdir -p $CONFIGTX_OUTPUT_DIR

BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"

PROFILE_BLOCK=${COMPANY}Genesis
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

$CURRENT/config/crypto-config-gen-go.sh $COMPANY -i $CRYPTO_CONFIG_FILE
$CURRENT/common/bin-manage/cryptogen/runCryptogen.sh -i "$CRYPTO_CONFIG_FILE" -o "$CRYPTO_CONFIG_DIR"

chmod 777 -R $CRYPTO_CONFIG_DIR # FIXME: dev only, not for prd

# NOTE IMPORTANT for node-sdk: clean stateDBcacheDir, otherwise cached crypto material will leads to Bad request:
# TODO more subtle control to do in nodejs
nodeAppConfigJson="$CURRENT/app/config.json"
stateDBCacheDir=$(jq -r '.stateDBCacheDir' $nodeAppConfigJson)
rm -rf $stateDBCacheDir
echo clear stateDBCacheDir $stateDBCacheDir

$CURRENT/config/configtx-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR -i $configtx_file -b $PROFILE_BLOCK

$CURRENT/common/bin-manage/configtxgen/runConfigtxgen.sh block create $BLOCK_FILE -p $PROFILE_BLOCK -i $config_dir

channelNames=$(echo $channelsConfig | jq -r "keys[]")
for channelName in $channelNames; do
	channelConfig=$(echo $channelsConfig | jq ".${channelName}")
	channelFilename=$(echo $channelConfig | jq -r ".file")
	channelFile="$CONFIGTX_OUTPUT_DIR/$channelFilename"
	./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $channelFile -p $channelName -i $config_dir -c ${channelName,,}
    #NOTE Capital char in Channel name is not supported  [channel: delphiChannel] Rejecting broadcast of config message from 172.18.0.1:36954 because of error: initializing configtx manager failed: Bad channel id: channel ID 'delphiChannel' contains illegal characters

done

# write back GOPATH
ChaincodeJson=$config_dir/chaincode.json
gopath=${CURRENT}/GOPATH/
jq ".GOPATH=\"${gopath}\"" $ChaincodeJson | sponge $ChaincodeJson
