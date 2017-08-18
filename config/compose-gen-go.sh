#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"

COMPOSE_FILE="$CURRENT/docker-compose.yaml"
CONFIG_JSON="$CURRENT/orgs.json"
# TODO if we use cli container to install chaincode, we need to set GOPATH in compose file; here we use node-sdk to do it
GOPATH="$(dirname $CURRENT)/GOPATH/"
IMAGE_TAG="x86_64-1.0.0" # latest

ledgersData_root="$(dirname $CURRENT)/ledgersData"
CONTAINER_ledgersData="/var/hyperledger/production/ledgersData"
CONTAINER_CONFIGTX_DIR="/etc/hyperledger/configtx"
CONTAINER_CRYPTO_CONFIG_DIR="/etc/hyperledger/crypto-config"
TLS_ENABLED=true

COMPANY=$1
MSPROOT=$2
BLOCK_FILE=$3

if [ -z "$COMPANY" ]; then
	echo "missing company parameter"
	exit 1
fi
remain_params=""
for ((i = 4; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "j:s:v:f:g:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;
	s)
		echo "set TLS_ENABLED string true|false (default: $TLS_ENABLED) ==> $OPTARG"
		TLS_ENABLED=$OPTARG
		;;
	v)
		echo "set docker image version tag (default: $IMAGE_TAG) ==> $OPTARG"
		IMAGE_TAG=$OPTARG
		;;
	f)
		echo "set docker-compose file (default: $COMPOSE_FILE) ==> $OPTARG"
		COMPOSE_FILE=$OPTARG
		;;
	g)
		echo "set GOPATH on host machine (default: $GOPATH) ==> $OPTARG"
		GOPATH=$OPTARG
		;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)

ordererConfig=$(jq -r ".$COMPANY.orderer" $CONFIG_JSON)
orderer_container_name=$(echo $ordererConfig | jq -r ".containerName")
ORDERER_CONTAINER=$orderer_container_name.$COMPANY_DOMAIN

orgsConfig=$(jq -r ".$COMPANY.orgs" $CONFIG_JSON)
orgNames=$(echo $orgsConfig | jq -r "keys[]")

ORDERER_HOST_PORT=$(echo $ordererConfig | jq -r ".portMap[0].host")
ORDERER_CONTAINER_PORT=$(echo $ordererConfig | jq -r ".portMap[0].container")

rm $COMPOSE_FILE
>"$COMPOSE_FILE"

COMPOSE_VERSION=2

yaml w -i $COMPOSE_FILE version \"$COMPOSE_VERSION\" # NOTE it should be a string, only version 3 support network setting

# dockerNetworkName=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)
#if [ $COMPOSE_VERSION = 3 ]; then
#    # FIXME empty input is not support
#    yaml w -i $COMPOSE_FILE networks.default.name $dockerNetworkName
#fi

# ccenv
yaml w -i $COMPOSE_FILE services.ccenv.image hyperledger/fabric-ccenv:$IMAGE_TAG
yaml w -i $COMPOSE_FILE services.ccenv.container_name ccenv.$COMPANY_DOMAIN

# orderer
ORDERER_SERVICE_NAME="OrdererServiceName.$COMPANY_DOMAIN" # orderer service name will linked to depends_on

p=0
function envPush() {
	local CMD="$1"
	$CMD.environment[$p] "$2"
	((p++))
}

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].container_name $ORDERER_CONTAINER
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].image hyperledger/fabric-orderer:$IMAGE_TAG
CONTAINER_GOPATH="/etc/hyperledger/gopath/"

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].command "orderer"
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].ports[0] $ORDERER_HOST_PORT:$ORDERER_CONTAINER_PORT

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[0] ORDERER_GENERAL_LOGLEVEL=debug
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[1] ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[2] ORDERER_GENERAL_GENESISMETHOD=file

orderer_hostName=${orderer_container_name,,}
orderer_hostName_full=$orderer_hostName.$COMPANY_DOMAIN
ORDERER_STRUCTURE="ordererOrganizations/$COMPANY_DOMAIN/orderers/$orderer_hostName_full"
CONTAINER_ORDERER_TLS_DIR="$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/tls"

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[3] ORDERER_GENERAL_GENESISFILE=$CONTAINER_CONFIGTX_DIR/$(basename $BLOCK_FILE)
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[4] ORDERER_GENERAL_TLS_ENABLED="$TLS_ENABLED"
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[5] ORDERER_GENERAL_TLS_PRIVATEKEY=$CONTAINER_ORDERER_TLS_DIR/server.key
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[6] ORDERER_GENERAL_TLS_CERTIFICATE=$CONTAINER_ORDERER_TLS_DIR/server.crt
# MSP
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[7] ORDERER_GENERAL_LOCALMSPID=OrdererMSP
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[8] ORDERER_GENERAL_LOCALMSPDIR=$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/msp

yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].volumes[0] "$(dirname $BLOCK_FILE):$CONTAINER_CONFIGTX_DIR"
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].volumes[1] "$MSPROOT:$CONTAINER_CRYPTO_CONFIG_DIR"

rootCAs=$CONTAINER_ORDERER_TLS_DIR/ca.crt
for orgName in $orgNames; do
	orgConfig=$(echo $orgsConfig | jq -r ".$orgName")
	PEER_DOMAIN=${orgName,,}.$COMPANY_DOMAIN
	USER_ADMIN=Admin@$PEER_DOMAIN
	org_peersConfig=$(echo $orgConfig | jq -r ".peers")
	ADMIN_STRUCTURE="peerOrganizations/$PEER_DOMAIN/users/$USER_ADMIN"
	for ((peerIndex = 0; peerIndex < $(echo $org_peersConfig | jq "length"); peerIndex++)); do
		PEER_ANCHOR=peer$peerIndex.$PEER_DOMAIN # TODO multi peer case, take care of any 'peer[0]' occurrence
		peerServiceName=$PEER_ANCHOR
		peerConfig=$(echo $org_peersConfig | jq -r ".[$peerIndex]")
		peerContainer=$(echo $peerConfig | jq -r ".containerName").$COMPANY_DOMAIN
		PEER_STRUCTURE="peerOrganizations/$PEER_DOMAIN/peers/$PEER_ANCHOR"
		rootCAs="$rootCAs,$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/ca.crt"
		# peer container
		#
		PEERCMD="yaml w -i $COMPOSE_FILE "services["$peerServiceName"]
		$PEERCMD.container_name $peerContainer
		$PEERCMD.depends_on[0] $ORDERER_SERVICE_NAME
		$PEERCMD.image hyperledger/fabric-peer:$IMAGE_TAG
		# NOTE working_dir just setting default commands current path
		$PEERCMD.command "peer node start"
		#common env
		p=0
		envPush "$PEERCMD" CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
		#FIXME docker compose network setting has problem: projectname is configured outside docker but in docker-compose cli
		envPush "$PEERCMD" CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$(basename $(dirname $COMPOSE_FILE))_default
		#    if [ $COMPOSE_VERSION = 3 ]; then
		#       $PEERCMD.networks[0] $dockerNetworkName
		#       envPush "$PEERCMD" CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$(basename $(dirname $COMPOSE_FILE))_$dockerNetworkName
		#    fi
		envPush "$PEERCMD" CORE_LOGGING_LEVEL=DEBUG
		envPush "$PEERCMD" CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true

		### GOSSIP setting
		envPush "$PEERCMD" CORE_PEER_GOSSIP_USELEADERELECTION=true
		envPush "$PEERCMD" CORE_PEER_GOSSIP_ORGLEADER=false
		envPush "$PEERCMD" CORE_PEER_GOSSIP_SKIPHANDSHAKE=true
		envPush "$PEERCMD" CORE_PEER_GOSSIP_EXTERNALENDPOINT=$peerContainer:7051
		# CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0:7051
		# only work when CORE_PEER_GOSSIP_ORGLEADER=true & CORE_PEER_GOSSIP_SKIPHANDSHAKE=false & CORE_PEER_GOSSIP_USELEADERELECTION=false
		envPush "$PEERCMD" CORE_PEER_LOCALMSPID=${orgName}MSP
		envPush "$PEERCMD" CORE_PEER_MSPCONFIGPATH=$CONTAINER_CRYPTO_CONFIG_DIR/$ADMIN_STRUCTURE/msp
		envPush "$PEERCMD" CORE_PEER_TLS_ENABLED=$TLS_ENABLED
		envPush "$PEERCMD" CORE_PEER_TLS_KEY_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/server.key
		envPush "$PEERCMD" CORE_PEER_TLS_CERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/server.crt
		envPush "$PEERCMD" CORE_PEER_TLS_ROOTCERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/ca.crt
		#individual env
		envPush "$PEERCMD" CORE_PEER_ID=$PEER_ANCHOR
		envPush "$PEERCMD" CORE_PEER_ADDRESS=$PEER_ANCHOR:7051

		peerPortMap=$(echo $peerConfig | jq ".portMap")

		for ((j = 0; j < $(echo $peerPortMap | jq "length"); j++)); do
			entry=$(echo $peerPortMap | jq ".[$j]")
			hostPort=$(echo $entry | jq ".host")
			containerPort=$(echo $entry | jq ".container")
			$PEERCMD.ports[$j] $hostPort:$containerPort
		done
		$PEERCMD.volumes[0] "/var/run/:/host/var/run/"
		$PEERCMD.volumes[1] "$MSPROOT:$CONTAINER_CRYPTO_CONFIG_DIR"          # for peer channel --cafile
		$PEERCMD.volumes[2] "$(dirname $BLOCK_FILE):$CONTAINER_CONFIGTX_DIR" # for later channel create
		ledgersData="$ledgersData_root/$peerContainer"
		mkdir -p $ledgersData
		$PEERCMD.volumes[3] "$ledgersData:$CONTAINER_ledgersData" # TODO sync ledgersData test

		#   TODO GO setup failed on peer container: only fabric-tools has go dependencies
		#set GOPATH map
		#
		#   envPush "$PEERCMD" GOPATH=$CONTAINER_GOPATH

		#GOPATH and working_dir conflict: ERROR: for PMContainerName.delphi.com  Cannot start service peer0.pm.delphi.com: oci runtime error: container_linux.go:262: starting container process caused "chdir to cwd (\"/opt/gopath/src/github.com/hyperledger/fabric/peer\") set in config.json failed: no such file or directory"
		#   $PEERCMD.volumes[3] "$GOPATH:$CONTAINER_GOPATH"
	done

	# CA
	CACMD="yaml w -i $COMPOSE_FILE "services["ca.$PEER_DOMAIN"]
	$CACMD.image hyperledger/fabric-ca:$IMAGE_TAG
	$CACMD.container_name "ca.$PEER_DOMAIN"
	$CACMD.command "sh -c 'fabric-ca-server start -b admin:adminpw -d'"
	CONTAINER_CA_VOLUME="$CONTAINER_CRYPTO_CONFIG_DIR/peerOrganizations/$PEER_DOMAIN/ca"
	CA_HOST_VOLUME="${MSPROOT}peerOrganizations/$PEER_DOMAIN/ca/"
	privkeyFilename=$(basename $(find $CA_HOST_VOLUME -type f \( -name "*_sk" \)))
	$CACMD.volumes[0] "$CA_HOST_VOLUME:$CONTAINER_CA_VOLUME"

	p=0
	envPush "$CACMD" "FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server" # align with command
	envPush "$CACMD" "FABRIC_CA_SERVER_CA_CERTFILE=$CONTAINER_CA_VOLUME/ca.$PEER_DOMAIN-cert.pem"
	envPush "$CACMD" "FABRIC_CA_SERVER_TLS_CERTFILE=$CONTAINER_CA_VOLUME/ca.$PEER_DOMAIN-cert.pem"

	envPush "$CACMD" "FABRIC_CA_SERVER_TLS_KEYFILE=$CONTAINER_CA_VOLUME/$privkeyFilename"
	envPush "$CACMD" "FABRIC_CA_SERVER_CA_KEYFILE=$CONTAINER_CA_VOLUME/$privkeyFilename"
	envPush "$CACMD" "FABRIC_CA_SERVER_TLS_ENABLED=$TLS_ENABLED"

	CA_HOST_PORT=$(echo $orgConfig | jq ".ca.portMap[0].host")
	CA_CONTAINER_PORT=$(echo $orgConfig | jq ".ca.portMap[0].container")
	$CACMD.ports[0] $CA_HOST_PORT:$CA_CONTAINER_PORT

done
yaml w -i $COMPOSE_FILE services["$ORDERER_SERVICE_NAME"].environment[9] "ORDERER_GENERAL_TLS_ROOTCAS=[$rootCAs]"

# NOTE: cli container is just a shadow of any existing peer! see the CORE_PEER_ADDRESS & CORE_PEER_MSPCONFIGPATH


# FIXME testCode: for peer channel update, seems cli is a good tool
CLICMD="yaml w -i $COMPOSE_FILE services.cli"
$CLICMD.container_name cli.$COMPANY_DOMAIN
$CLICMD.image hyperledger/fabric-tools:$IMAGE_TAG

p=0

envPush "$CLICMD" CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
envPush "$CLICMD" CORE_LOGGING_LEVEL=DEBUG
envPush "$CLICMD" CORE_PEER_ID=cli.$COMPANY_DOMAIN
envPush "$CLICMD" CORE_PEER_ADDRESS=$ORDERER_CONTAINER:$ORDERER_CONTAINER_PORT
envPush "$CLICMD" CORE_PEER_LOCALMSPID=OrdererMSP
envPush "$CLICMD" CORE_PEER_MSPCONFIGPATH=$CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/users/Admin@$COMPANY_DOMAIN/msp
envPush "$CLICMD" CORE_PEER_TLS_ROOTCERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/users/Admin@$COMPANY_DOMAIN/tls/ca.crt

envPush "$CLICMD" GOPATH=$CONTAINER_GOPATH

$CLICMD.volumes[0] /var/run/:/host/var/run/
$CLICMD.volumes[1] "$MSPROOT:$CONTAINER_CRYPTO_CONFIG_DIR"
$CLICMD.volumes[2] "$GOPATH:$CONTAINER_GOPATH"
$CLICMD.command "sleep infinity" # NOTE any kind of hanging is required, otherwise container will not be started when docker-compose up

# NOTE In fabric-tools:
#   cryptogen version: development build
#   configtxgen version: development build
# NOTE tty: indicate terminal connection
