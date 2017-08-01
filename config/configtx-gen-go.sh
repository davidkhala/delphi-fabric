#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

configtx_file="$CURRENT/configtx.yaml"

################### company, orgs setting
CONFIG_JSON="$CURRENT/orgs.json"
COMPANY=$1
if [ -z "$COMPANY" ]; then
	echo "missing company param"
	exit 1
fi
orgs=()
PROFILE_BLOCK=${COMPANY}Genesis   # Take care, it is not file!
PROFILE_CHANNEL=${COMPANY}Channel # Take care, it is not file!
remain_params=""
for ((i = 3; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done

while getopts "j:i:b:c:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;

	i)
		echo "set configtx yaml file (default: $configtx_file) ==> $OPTARG"
		configtx_file="$OPTARG"
		;;
	b)
		echo "set block profile (default: $PROFILE_BLOCK) ==> $OPTARG"
		PROFILE_BLOCK="$OPTARG"
		;;
	c)
		echo "set channel profile (default: $PROFILE_CHANNEL) ==> $OPTARG"
		PROFILE_CHANNEL="$OPTARG"
		;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done

# build orgs from config.json
p2=$(jq -r ".$COMPANY.orgs|keys[]" $CONFIG_JSON)
if [ "$?" -eq "0" ]; then
	for org in $p2; do
		orgs+=($org)
	done
else
	echo "invalid organization json param:"
	echo "--company: $COMPANY"
	exit 1
fi
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)

###################

MSPROOT=$2
if [ -z "$MSPROOT" ]; then
	echo "missing MSPROOT param. Generally, it should be .../crypto-config"
	exit 1
fi
orgs=()

p2=$(jq -r ".$COMPANY.orgs|keys[]" $CONFIG_JSON)
if [ "$?" -eq "0" ]; then
	for org in $p2; do
		orgs+=($org)
	done
else
	echo "invalid organization json param:"
	echo "--company: $COMPANY"
	exit 1
fi

ORDERER_CONTAINER_PORT=$(jq -r ".$COMPANY.orderer.portMap[0].container" $CONFIG_JSON)
ANCHOR_PEER_CONTAINER_PORT=7051

ORDERER_CONTAINER=$(jq -r ".$COMPANY.orderer.containerName" $CONFIG_JSON).$COMPANY_DOMAIN

rm $configtx_file
>$configtx_file
# block profile

yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.OrdererType 'solo'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Addresses[0] $ORDERER_CONTAINER:$ORDERER_CONTAINER_PORT
# containerFullName:container port, see in marbles
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchTimeout '2s'

yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.MaxMessageCount 10
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.AbsoluteMaxBytes '99 MB'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.PreferredMaxBytes '512 KB'
# TODO: MSP name here is using assumption here, make sure it align with other modules
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].Name $(jq -r ".$COMPANY.orderer.MSP.name" $CONFIG_JSON)
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].ID $(jq -r ".$COMPANY.orderer.MSP.id" $CONFIG_JSON)
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].MSPDir "${MSPROOT}ordererOrganizations/$COMPANY_DOMAIN/msp"

for ((i = 0; i < ${#orgs[@]}; i++)); do
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].Name ${orgs[$i]}MSPName
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].ID ${orgs[$i]}MSP
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].MSPDir \
		"${MSPROOT}peerOrganizations/${orgs[$i],,}.$COMPANY_DOMAIN/msp"

	peerContainer=$(jq -r ".$COMPANY.orgs.${orgs[$i]}.peers[0].containerName" $CONFIG_JSON).$COMPANY_DOMAIN

	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].AnchorPeers[0].Host \
		$peerContainer
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].AnchorPeers[0].Port \
		$ANCHOR_PEER_CONTAINER_PORT

done

# channel profile
yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Consortium SampleConsortium
for ((i = 0; i < ${#orgs[@]}; i++)); do
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].Name $(jq -r ".$COMPANY.orgs.${orgs[$i]}.MSP.name" $CONFIG_JSON)

	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].ID $(jq -r ".$COMPANY.orgs.${orgs[$i]}.MSP.id" $CONFIG_JSON)
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].MSPDir \
		"${MSPROOT}peerOrganizations/${orgs[$i],,}.$COMPANY_DOMAIN/msp"

	peerContainer=$(jq -r ".$COMPANY.orgs.${orgs[$i]}.peers[0].containerName" $CONFIG_JSON).$COMPANY_DOMAIN
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].AnchorPeers[0].Host \
		$peerContainer
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].AnchorPeers[0].Port \
		$ANCHOR_PEER_CONTAINER_PORT
done
