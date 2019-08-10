#!/usr/bin/env bash
action=restart node docker.js
sleep 1
docker logs test-docker
