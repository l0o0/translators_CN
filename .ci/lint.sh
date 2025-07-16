#!/usr/bin/env bash
set -euo pipefail

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

. "$dir/helper.sh"

translators_to_check=$(get_translators_to_check)
if [ -n "$translators_to_check" ]; then
  # No `xargs -d` support in macOS, so workaround with `tr`
	echo "$translators_to_check" | tr '\n' '\0' | xargs -0 npm run lint --
fi
