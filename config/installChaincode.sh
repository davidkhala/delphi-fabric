#!/usr/bin/env bash

# TODO: NOT COMPLETED
# TODO: see in: https://jira.hyperledger.org/browse/FAB-2493?focusedCommentId=21334&page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel
# TODO: possible solution: use fabric-tools image as cli broadcaster

# Error: Must supply value for chaincode name, path and version parameters.

function installGo(){
    local PEER_CONTAINER="$1"
    docker exec -it $PEER_CONTAINER sh -c "apt-get install software-properties-common"
    docker exec -it $PEER_CONTAINER sh -c "add-apt-repository ppa:longsleep/golang-backports -y"
    docker exec -it $PEER_CONTAINER sh -c "apt-get update"
    docker exec -it $PEER_CONTAINER sh -c "apt-get install -y golang-go"
    # After this operation, 360 MB of additional disk space will be used.
    # even with this : dependencies go src is still missing
}
COMPANY=delphi
CONTAINER_CHAINCODE_PATH=github.com/delphi

CHAINCODE_NAME=$(basename $CONTAINER_CHAINCODE_PATH)
VERSION="1.0"

PEER_CONTAINER=BUContainerName.delphi.com

remain_params=""
while getopts "j:n:v:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;
    n)
        echo "set chaincode name (default $CHAINCODE_NAME)==> $OPTARG"
        CHAINCODE_NAME=$OPTARG
    ;;
    v)
        echo "set chaincode version (default:$VERSION) ==> $OPTARG"
        VERSION=$OPTARG
    ;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done

docker exec -it $PEER_CONTAINER sh -c "peer chaincode install -n $CHAINCODE_NAME -v $VERSION -p $CONTAINER_CHAINCODE_PATH"

# peer chaincode install -n fabcar -v 1.0 -p github.com/fabcar
# FIXME: if golang missing >> Error: Error getting chaincode code chaincode: <go, [env]>: failed with error: "exec: not started"
# FIXME: if dependencies missing >> can't load package: package github.com/hyperledger/fabric/protos/ledger/queryresult: cannot find package "github.com/hyperledger/fabric/protos/ledger/queryresult" in any of:
#        /usr/lib/go-1.8/src/github.com/hyperledger/fabric/protos/ledger/queryresult (from $GOROOT)
#        /etc/hyperledger/gopath/src/github.com/hyperledger/fabric/protos/ledger/queryresult (from $GOPATH)

#
