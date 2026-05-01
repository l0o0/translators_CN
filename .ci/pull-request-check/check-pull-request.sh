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

# Read constants from the shared JS constants file
export CHROME_EXTENSION_KEY=$(node -e "import('$ROOT_DIR/constants.mjs').then(m => process.stdout.write(m.CHROME_EXTENSION_KEY))")
export ZOTERO_REPOSITORY_URL=$(node -e "import('$ROOT_DIR/constants.mjs').then(m => process.stdout.write(m.TRANSLATOR_SERVER_URL))")
export ZOTERO_ALWAYS_FETCH_FROM_REPOSITORY=1
./build.sh -p b -d
cd ..

echo "::endgroup::"

if [ $# -gt 0 ]; then
	translators="$*"
else
	translators="$(get_translators_to_check)"
fi

node browser-test.mjs "$translators"

