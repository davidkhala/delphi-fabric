#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
fcn=$1

#   install mikefarah/yaml
yamlVersion=1.13.1

function yamlBin() {
	wget https://github.com/mikefarah/yaml/releases/download/${yamlVersion}/yaml_linux_amd64
	chmod +x yaml_linux_amd64
	mv yaml_linux_amd64 /usr/local/bin/yaml
}
function yamlGolang() {
	if ! go version; then
		$CURRENT/common/install.sh golang
	fi
	#	FIXME: because go get cannot specify a tag, consider about https://github.com/golang/dep
	go get github.com/mikefarah/yaml
}

if [ -n "$fcn" ]; then
	$fcn
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		git submodule update --init --recursive
	fi
	$CURRENT/common/install.sh
	# write to config: jq do not support in-place editing, use moreutils:sponge
	apt -qq install -y moreutils
	npm install
fi
