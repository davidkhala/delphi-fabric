#!/usr/bin/env bash

# TODO: not complete yet

sudo apt-get -qq install -y jq
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_JSON="$CURRENT/orgs.json"

CONTAINER_CONFIGTX_DIR="/etc/hyperledger/configtx"
CONTAINER_CRYPTO_CONFIG_DIR="/etc/hyperledger/crypto-config"
CONTAINER_OUTPUTFILE="$CONTAINER_CONFIGTX_DIR/fetchOutput"
TLS_ENABLED=true

COMPANY=$1 # delphi

CHANNEL_NAME=$2 # delphichannel

PEER_CONTAINER=$3 # BUContainerName.delphi.com

FETCH_TARGET=$4 # <newest|oldest|config|(number)>
remain_params=""
for ((i = 5; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "j:s:o:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;
	s)
		echo "set TLS_ENABLED string true|false (default: $TLS_ENABLED) ==> $OPTARG"
		TLS_ENABLED=$OPTARG
		;;
    o)
        echo "set fetch output file path in CONTAINER (default: $CONTAINER_OUTPUTFILE) ==> $OPTARG"
        CONTAINER_OUTPUTFILE=$OPTARG
    ;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)

orderer_container_name=$(jq -r ".$COMPANY.orderer.containerName" $CONFIG_JSON)

orderer_hostName=${orderer_container_name,,}
orderer_hostName_full=$orderer_hostName.$COMPANY_DOMAIN
ORDERER_CONTAINER=$orderer_container_name.$COMPANY_DOMAIN
tls_opts="--tls --cafile $CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/orderers/$orderer_hostName_full/tls/ca.crt"

ORDERER_ENDPOINT="$ORDERER_CONTAINER:7050" # Must for channel create or Error: Ordering service endpoint  is not valid or missing
# orderer endpoint should use container port
orderer_opts="-o $ORDERER_ENDPOINT"

echo =====$PEER_CONTAINER fetch channel
fetchCMD="peer channel fetch $FETCH_TARGET $CONTAINER_OUTPUTFILE $tls_opts $orderer_opts -c ${CHANNEL_NAME,,}"
echo CMD: $fetchCMD
docker exec -ti $PEER_CONTAINER sh -c "$fetchCMD"


# TODO peer channel fetch config config_block.pb -o orderContainerName.delphi.com:7050 -c delphichannel
#<newest|oldest|config|(number)> [outputfile] [flags]
# if --channelID, -c missing : Error: can't read the block
#
#   newest|oldest|config|number<block: ...Received block:0
#   number>block num+1: Error: proto: Marshal called with nil
#   number>block:hanging