#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
MSPROOT="$config_dir/crypto-config/"

COMPANY='delphi' # must match to config_json
companyConfig=$(jq ".$COMPANY" $CONFIG_JSON)
channelsConfig=$(echo $companyConfig | jq ".channels")
CONFIGTX_DIR="$config_dir/configtx"
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

node -e "require('./config/crypto-config.js').gen({\"COMPANY\":\"$COMPANY\"})"
$CURRENT/common/bin-manage/cryptogen/runCryptogen.sh -i "$CRYPTO_CONFIG_FILE" -o "$MSPROOT"

jq ".$COMPANY.docker.volumes.MSPROOT.dir=\"$MSPROOT\"" $CONFIG_JSON | sponge $CONFIG_JSON

chmod 777 -R $MSPROOT # FIXME: dev only, not for prd

# NOTE IMPORTANT for node-sdk: clean stateDBcacheDir, otherwise cached crypto material will leads to Bad request:
# TODO more subtle control to do in nodejs
nodeAppConfigJson="$CURRENT/app/config.json"
stateDBCacheDir=$(jq -r '.stateDBCacheDir' $nodeAppConfigJson)
rm -rf $stateDBCacheDir
echo clear stateDBCacheDir $stateDBCacheDir

node -e "require('./config/configtx.js').gen({\"COMPANY\":\"$COMPANY\",\"MSPROOT\":\"$MSPROOT\"})"

BLOCK_FILE=$(echo $companyConfig|jq -r ".orderer.genesis_block.file")
PROFILE_BLOCK=$(echo $companyConfig|jq -r ".orderer.genesis_block.profile")

./common/bin-manage/configtxgen/runConfigtxgen.sh block create "$CONFIGTX_DIR/$BLOCK_FILE" -p $PROFILE_BLOCK -i $config_dir

channelNames=$(echo $channelsConfig | jq -r "keys[]")
for channelName in $channelNames; do
	channelConfig=$(echo $channelsConfig | jq ".${channelName}")
	channelFilename=$(echo $channelConfig | jq -r ".file")
	channelFile="$CONFIGTX_DIR/$channelFilename"
	./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $channelFile -p $channelName -i $config_dir -c ${channelName,,}
    #NOTE Capital char in Channel name is not supported  [channel: delphiChannel] Rejecting broadcast of config message from 172.18.0.1:36954 because of error: initializing configtx manager failed: Bad channel id: channel ID 'delphiChannel' contains illegal characters
done
jq ".$COMPANY.docker.volumes.CONFIGTX.dir=\"$CONFIGTX_DIR\"" $CONFIG_JSON | sponge $CONFIG_JSON

chaincodeJSON=$config_dir/chaincode.json
chmod 777 $chaincodeJSON
GOPATH=$(go env GOPATH)
jq ".GOPATH=\"$GOPATH\"" $chaincodeJSON | sponge $chaincodeJSON

go get -u "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json
