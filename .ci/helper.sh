#!/bin/bash

if [[ -t 1 && "$(tput colors)" -gt 0 ]]; then
    export color_ok=$'\e[32;1m'
    export color_notok=$'\e[31;1m'
    export color_warn=$'\e[33m'
    export color_err=$'\e[31m'
    export color_reset=$'\e[0m'
fi

get_translator_id() {
    if [[ -n "$1" ]];then
        grep -r '"translatorID"' "$@" | sed -e 's/[" ,]//g' -e 's/^.*://g'
    else
        while read line;do
            echo "$line"|grep '"translatorID"' | sed -e 's/[" ,]//g' -e 's/^.*://g'
        done
    fi
}

get_translators_to_check() {
	# Get the last commit on the target branch before this branch diverged
    # Fall back to translators changed on the last commit in case there's no GITHUB_BASE_REF
    # and no upstream/master (CI runs on push)
	local fork_point=$(git merge-base --fork-point ${GITHUB_BASE_REF:-upstream/master} HEAD 2>/dev/null || echo HEAD~)
	# Get translator scripts changed between that commit and now, excluding deleted files
	local all_translator_scripts="$(git rev-parse --show-toplevel)"/*.js
	git diff --name-only --diff-filter=d $fork_point -- $all_translator_scripts
}
