#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

COMPOSE_FILE="docker-compose.yaml"
CONFIG_JSON="orgs.json"
IMAGE_TAG="x86_64-1.0.0" # latest
TLS_ENABLED=true

company=$1
MSPROOT=$2
BLOCK_FILE=$3
orgs=()


if [ -z "$company" ]; then
    echo "missing company parameter"
    exit 1
fi
company_domain="${company,,}.com"

ORDEER_CRYPTO_HOSTNAME="orderer" # TODO
CONTAINER_ORDERER_NAME="$ORDEER_CRYPTO_HOSTNAME.$company_domain"

# using json as config
remain_params=""
for ((i = 5; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "s:v:t:" shortname $remain_params; do
	case $shortname in
	s)
		echo "set TLS_ENABLED string true|false (default: $TLS_ENABLED) ==> $OPTARG"
		TLS_ENABLED="$OPTARG"
		;;
	v)
		echo "set docker image tag (default: $IMAGE_TAG) ==> $OPTARG"
		$IMAGE_TAG="$OPTARG"
		;;
    t)

    ;;
	?) #当有不认识的选项的时候arg为?
		echo "unknown argument"
		exit 1
		;;
	esac
done
p2=$(jq -r ".$company.orgs|keys[]" $CONFIG_JSON)
if [ "$?" -eq "0" ]; then
	for org in $p2; do
		orgs+=( $org )
	done
	echo "organization set to ${orgs[@]}"
else
	echo "invalid organization json param: $p2"
	exit 1
fi


ORDERER_PORT=$(jq -r ".$company.orderer.portMap[0]" $CONFIG_JSON)

rm $COMPOSE_FILE
>"$COMPOSE_FILE"

# ccenv
yaml w -i $COMPOSE_FILE version \"2\" # NOTE it should be a string
yaml w -i $COMPOSE_FILE services.ccenv.image hyperledger/fabric-ccenv:$IMAGE_TAG
yaml w -i $COMPOSE_FILE services.ccenv.container_name ccenv.$company_domain

# orderer
ORDERER_SERVICE_NAME="AnyServiceName" # orderer service name will linked to depends_on

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].container_name $CONTAINER_ORDERER_NAME
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].image hyperledger/fabric-orderer:$IMAGE_TAG
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].working_dir /opt/gopath/src/github.com/hyperledger/fabric/orderers
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].command "orderer"
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].ports[0] "$ORDERER_PORT"

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[0] ORDERER_GENERAL_LOGLEVEL=debug
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[1] ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[2] ORDERER_GENERAL_GENESISMETHOD=file

container_crypto_config_dir="/etc/hyperledger/crypto-config/"
container_orderer_tls_dir="${container_crypto_config_dir}ordererOrganizations/$company_domain/orderers/$CONTAINER_ORDERER_NAME/tls/"

container_block_file_dir="/etc/hyperledger/configtx/"

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[3] ORDERER_GENERAL_GENESISFILE=$container_block_file_dir$(basename $BLOCK_FILE)
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[4] ORDERER_GENERAL_TLS_ENABLED="$TLS_ENABLED"
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[5] ORDERER_GENERAL_TLS_PRIVATEKEY=${container_orderer_tls_dir}server.key
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[6] ORDERER_GENERAL_TLS_CERTIFICATE=${container_orderer_tls_dir}server.crt

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].volumes[0] "$(dirname $BLOCK_FILE):$container_block_file_dir"
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].volumes[1] "$MSPROOT:$container_crypto_config_dir"

rootCAs=${container_orderer_tls_dir}ca.crt
for ((i = 0; i < ${#orgs[@]}; i++)); do
    peerDomain=${orgs[$i],,}.$company_domain
    peerAnchor=peer0.$peerDomain
    peerContainer=$peerAnchor
    _shared_structure="peerOrganizations/$peerDomain/peers/$peerAnchor"
    rootCAs="$rootCAs,$container_crypto_config_dir$_shared_structure/tls/ca.crt"

    # peer container
    #
    PEERCMD="yaml w -i $COMPOSE_FILE "services["${peerContainer}"]
    $PEERCMD.container_name $peerContainer
    $PEERCMD.depends_on[0] $ORDERER_SERVICE_NAME
    $PEERCMD.image hyperledger/fabric-peer:$IMAGE_TAG
    $PEERCMD.working_dir /opt/gopath/src/github.com/hyperledger/fabric/peer
    $PEERCMD.command "peer node start"

    #common env
    p=0
    function envPush(){
        local CMD="$1"
        $CMD.environment[$p] "$2"
        ((p++))
    }
    envPush "$PEERCMD" CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
    envPush "$PEERCMD" CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$company
    envPush "$PEERCMD" CORE_LOGGING_LEVEL=DEBUG
    envPush "$PEERCMD" CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true
    envPush "$PEERCMD" CORE_PEER_GOSSIP_USELEADERELECTION=true
    envPush "$PEERCMD" CORE_PEER_GOSSIP_ORGLEADER=false
    envPush "$PEERCMD" CORE_PEER_GOSSIP_SKIPHANDSHAKE=true
    envPush "$PEERCMD" CORE_PEER_MSPCONFIGPATH=$container_crypto_config_dir$_shared_structure/msp
    envPush "$PEERCMD" CORE_PEER_TLS_ENABLED=$TLS_ENABLED
    envPush "$PEERCMD" CORE_PEER_TLS_KEY_FILE=$container_crypto_config_dir$_shared_structure/tls/server.key
    envPush "$PEERCMD" CORE_PEER_TLS_CERT_FILE=$container_crypto_config_dir$_shared_structure/tls/server.crt
    envPush "$PEERCMD" CORE_PEER_TLS_ROOTCERT_FILE=$container_crypto_config_dir$_shared_structure/tls/ca.crt

    #individual env
    envPush "$PEERCMD" CORE_PEER_ID=$peerContainer
    envPush "$PEERCMD" CORE_PEER_ADDRESS=$peerContainer:7051


    ports=$(jq ".$company.orgs.${orgs[$i]}.peers[0].portMap[]" $CONFIG_JSON)
    j=0
    for port in $ports;
    do
       $PEERCMD.ports[$j] $port
       ((j++))
    done
    $PEERCMD.volumes[0] "/var/run/:/host/var/run/"
    $PEERCMD.volumes[1] "$MSPROOT/${_shared_structure}:$container_crypto_config_dir$_shared_structure"


    # CA
    p=0
    CACMD="yaml w -i $COMPOSE_FILE "services["ca.$peerDomain"]
    $CACMD.image hyperledger/fabric-ca:$IMAGE_TAG
    $CACMD.container_name "ca.$peerDomain"
    $CACMD.command "sh -c 'fabric-ca-server start -b admin:adminpw -d'"
    CA_CONTAINER_VOLUME="${container_crypto_config_dir}peerOrganizations/$peerDomain/ca/"
    CA_HOST_VOLUME="$MSPROOT/peerOrganizations/$peerDomain/ca/"
    privkeyFilename=$(basename $(find $CA_HOST_VOLUME -type f \( -name "*_sk" \)))
    $CACMD.volumes[0] "$CA_HOST_VOLUME:$CA_CONTAINER_VOLUME"

    envPush "$CACMD" "FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server" # align with command
    envPush "$CACMD" "FABRIC_CA_SERVER_CA_CERTFILE=${CA_CONTAINER_VOLUME}ca.$peerDomain-cert.pem"
    envPush "$CACMD" "FABRIC_CA_SERVER_TLS_CERTFILE=${CA_CONTAINER_VOLUME}ca.$peerDomain-cert.pem"

    envPush "$CACMD" "FABRIC_CA_SERVER_TLS_KEYFILE=${CA_CONTAINER_VOLUME}$privkeyFilename"
    envPush "$CACMD" "FABRIC_CA_SERVER_CA_KEYFILE=${CA_CONTAINER_VOLUME}$privkeyFilename"
    envPush "$CACMD" "FABRIC_CA_SERVER_TLS_ENABLED=$TLS_ENABLED"

    ports=$(jq ".$company.orgs.${orgs[$i]}.ca.portMap[]" $CONFIG_JSON)
    j=0
    for port in $ports;
    do
       $CACMD.ports[$j] $port
       ((j++))
    done

done
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[7] "ORDERER_GENERAL_TLS_ROOTCAS=[$rootCAs]"












