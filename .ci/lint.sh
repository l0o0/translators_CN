#!/usr/bin/env bash
set -euo pipefail

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

. "$dir/helper.sh"

get_translators_to_check
if [ -n "$TRANSLATORS_TO_CHECK" ]; then
  # No `xargs -d` support in macOS, so workaround with `tr`
	echo "$TRANSLATORS_TO_CHECK" | tr '\n' '\0' | xargs -0 npm run lint --
fi
