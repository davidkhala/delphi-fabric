#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

CONFIG_DIR="$CURRENT/config"
CONFIG_JSON=$CONFIG_DIR/orgs.json

volumesConfig=$(jq -r ".docker.volumes" $CONFIG_JSON)

CONFIGTXVolume=CONFIGTX_local
MSPROOTVolume=MSPROOT_local

VERSION=$(jq -r ".docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"

#############
node -e "require('./config/docker-compose.js').genCAs({type:'local'})"
caCOMPOSE_FILE=$CONFIG_DIR/docker-ca-compose.yaml
COMPOSE_FILE="$CONFIG_DIR/docker-compose.yaml"
caCryptoConfig=$CURRENT/config/ca-crypto-config
dockerNetworkName=$(jq -r ".docker.network" $CONFIG_JSON)

docker-compose -f $caCOMPOSE_FILE down
docker-compose -f $COMPOSE_FILE down
commonDir="$CURRENT/common"
$commonDir/rmChaincodeContainer.sh container "dev"
$commonDir/rmChaincodeContainer.sh image "dev"
docker system prune --force
if docker network ls | grep $dockerNetworkName; then
	docker network rm $dockerNetworkName
fi

if ! docker network ls | grep $dockerNetworkName; then
	docker network create $dockerNetworkName
fi
docker-compose -f $caCOMPOSE_FILE up -d
echo sleep 5
sleep 5
sudo rm -rf $caCryptoConfig
node -e "require('./config/ca-crypto-gen.js').genAll()"

#############

configtx_file="$CONFIG_DIR/configtx.yaml"
companyConfig=$(jq "." $CONFIG_JSON)
channelsConfig=$(echo $companyConfig | jq ".channels")
CONFIGTX_DIR=$(jq -r ".docker.volumes.CONFIGTX.dir" $CONFIG_JSON)
mkdir -p $CONFIGTX_DIR

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

# NOTE IMPORTANT for node-sdk: clean stateDBcacheDir, otherwise cached crypto material will leads to Bad request:
# TODO more subtle control to do in nodejs
nodeAppConfigJson="$CURRENT/app/config.json"
stateDBCacheDir=$(jq -r '.stateDBCacheDir' $nodeAppConfigJson)
rm -rf $stateDBCacheDir
echo clear stateDBCacheDir $stateDBCacheDir

BLOCK_FILE=$(echo $companyConfig | jq -r ".orderer.genesis_block.file")
PROFILE_BLOCK=$(echo $companyConfig | jq -r ".orderer.genesis_block.profile")
node -e "require('./config/configtx.js').gen({MSPROOT:'${caCryptoConfig}',PROFILE_BLOCK:'${PROFILE_BLOCK}'})"

./common/bin-manage/runConfigtxgen.sh block create "$CONFIGTX_DIR/$BLOCK_FILE" -p $PROFILE_BLOCK -i $CONFIG_DIR

channelNames=$(echo $channelsConfig | jq -r "keys[]")
for channelName in $channelNames; do
	channelConfig=$(echo $channelsConfig | jq ".${channelName}")
	channelFilename=$(echo $channelConfig | jq -r ".file")
	channelFile="$CONFIGTX_DIR/$channelFilename"
	./common/bin-manage/runConfigtxgen.sh channel create $channelFile -p $channelName -i $CONFIG_DIR -c ${channelName,,}
done

chaincodeJSON=$CONFIG_DIR/chaincode.json

go get -u "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json

if [ -f "$COMPOSE_FILE" ]; then
	./docker.sh down
fi

docker volume prune --force
CONFIGTX_DIR=$(echo $volumesConfig | jq -r ".CONFIGTX.dir") # update in testBin.sh

$CURRENT/common/docker/utils/volume.sh createLocal $MSPROOTVolume $caCryptoConfig
$CURRENT/common/docker/utils/volume.sh createLocal $CONFIGTXVolume $CONFIGTX_DIR

./common/docker/utils/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
node -e "require('./config/docker-compose').gen({MSPROOT:'$caCryptoConfig',COMPOSE_FILE:'$COMPOSE_FILE',type: 'local',volumeName:{CONFIGTX:'$CONFIGTXVolume',MSPROOT:'$MSPROOTVolume'}})"
docker-compose -f $COMPOSE_FILE up -d
