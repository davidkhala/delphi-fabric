#!/usr/bin/env bash
set -e
m1="install and approve"
mocha install.js --grep "^${m1} install$"
mocha install.js --grep "^${m1} query installed & approve$"
m2="commit"
mocha install.js --grep "^${m2} commit$"

