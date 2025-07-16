#!/usr/bin/env bash
set -euo pipefail

echo "::group::Setup"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( dirname "$DIR" )"

. "$ROOT_DIR/helper.sh"

# Build connector
mkdir -p connectors
cd connectors

if [ -d .git ]; then
	# Temp fix for connectors/src/zotero/resource/schema/global submodule fetch failing
	git config url."https://".insteadOf git://
	git pull
	git submodule update
	git -C src/zotero/ submodule update -- resource/schema/global
	git -C src/zotero submodule update -- resource/SingleFile
	npm ci
else
	git clone https://github.com/zotero/zotero-connectors.git --depth 1 .
	git config url."https://".insteadOf git://
	git submodule update --init --depth 1
	git -C src/zotero submodule update --init --depth 1 -- resource/schema/global
	git -C src/zotero submodule update --init --depth 1 -- resource/SingleFile
	npm ci
fi

export ZOTERO_REPOSITORY_URL="http://localhost:8085/"
export CHROME_EXTENSION_KEY="MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDllBS5q+Z9T9tPgYwRN+/8T9wzyjo9tRo03Wy8zP2DQ5Iy+3q0Tjq2vKXGiMCxC/ZVuEMC68Ekv+jNT43VxPbEXI4dzpK1GMBqPJpAcEOB8B1ROBouQMbGGTG7fOdQVlmpdTTPVndVwysJ02CrDMn96IG2ytOq2PO7GR2xleCudQIDAQAB"
./build.sh -p b -d
cd ..

echo "::endgroup::"

./selenium-test.js "$(get_translators_to_check)"

