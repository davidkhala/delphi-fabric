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
	ln -s $(which yaml) /usr/local/bin/yaml

}
function cn(){
    if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
    $CURRENT/common/install.sh cn
    apt -qq install -y moreutils
	npm install
	yamlGolang
}
function gitSync(){
    git pull
    git submodule update --init --recursive
}

if [ -n "$fcn" ]; then
	$fcn
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh
	# write to config: jq do not support in-place editing, use moreutils:sponge
	apt -qq install -y moreutils
	npm install
	yamlBin
fi
