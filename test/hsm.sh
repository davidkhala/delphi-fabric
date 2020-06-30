set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
projectRoot=$(dirname $CURRENT)
export SOFTHSM2_CONF=$projectRoot/config/softhsm2.conf
echo SOFTHSM2_CONF=$SOFTHSM2_CONF
mkdir -p /tmp/softHSM2/ ## align with softhsm2.conf
label="fabric"
echo "cleaning up hsm"
rm -rf /tmp/softHSM2/*
export HSM_SO_PIN="fabric"
export HSM_PIN="fabric"
$projectRoot/common/bash/softHSM.sh initToken $label 0

