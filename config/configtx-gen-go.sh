#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

configtx_file="configtx.yaml"
company=$1
if [ -z "$company" ]; then
	echo "missing company param"
	exit 1
fi
company_domain="${company,,}.com"

MSPROOT=$3
if [ -z "$MSPROOT" ]; then
	echo "missing MSPROOT param. Generally, it should be .../crypto-config"
	exit 1
fi
orgs=()

if [ -z "$2" ]; then
	echo "missing organization param"
	exit 1
fi
if echo "$2" | jq '.'; then
	echo "set organization from json $2"
	length=$(echo $2 | jq '.|length')
	for ((i = 0; i < $length; i++)); do
		orgs[i]=$(echo $2 | jq -r ".[$i]")
	done
	echo "organization set to ${orgs[@]}"
else
	echo "invalid organization json param: $2"
	exit 1
fi

PROFILE_BLOCK=${company}Genesis
PROFILE_CHANNEL=${company}Channel

ORDERER_PORT=7050
ANCHOR_PEER_PORT=7051
remain_params=""
for ((i = 4; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "i:b:c:o:a:" shortname $remain_params; do
	case $shortname in
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
	o)
		echo "set orderer port (default: $ORDERER_PORT) ==> $OPTARG"
		ORDERER_PORT="$OPTARG"
		;;
	a)
		echo "set anchor peer port (default: $ANCHOR_PEER_PORT) ==> $OPTARG"
		ANCHOR_PEER_PORT="$OPTARG"
		;;
	?) #当有不认识的选项的时候arg为?
		echo "unknown argument"
		exit 1
		;;
	esac
done

orderer_container="orderer.$company_domain"

rm $configtx_file
>$configtx_file
# block profile

yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.OrdererType 'solo'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Addresses[0] $orderer_container:$ORDERER_PORT
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchTimeout '2s'

yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.MaxMessageCount 10
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.AbsoluteMaxBytes '99 MB'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.PreferredMaxBytes '512 KB'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].Name OrdererMSPName
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].ID OrdererMSP
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].MSPDir "${MSPROOT}ordererOrganizations/$company_domain/msp"

for ((i = 0; i < ${#orgs[@]}; i++)); do
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].Name ${orgs[$i]}MSPName
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].ID ${orgs[$i]}MSP
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].MSPDir \
		"${MSPROOT}peerOrganizations/${orgs[$i],,}.$company_domain/msp"
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].AnchorPeers[0].Host \
		"peer0.${orgs[$i],,}.$company_domain"
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].AnchorPeers[0].Port \
		$ANCHOR_PEER_PORT

done

# channel profile
yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Consortium SampleConsortium
for ((i = 0; i < ${#orgs[@]}; i++)); do
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].Name ${orgs[$i]}MSPName

	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].ID ${orgs[$i]}MSP
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].MSPDir \
		"${MSPROOT}peerOrganizations/${orgs[$i],,}.$company_domain/msp"
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].AnchorPeers[0].Host \
		"peer0.${orgs[$i],,}.$company_domain"
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].AnchorPeers[0].Port \
		$ANCHOR_PEER_PORT
done
