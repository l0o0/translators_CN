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
	# If a PR branch has no conflicts with the master then git
	# creates a custom merge commit where it merges PR into master.
	# Travis-CI tests on that commit instead of the HEAD of the PR branch.
	#
	# Thus below we first determine if HEAD is a merge commit by checking how
	# many parents the current HEAD has. If number of parents > 1, then it's a merge commit
	# in which case we need to diff translator names between HEAD^2 and PR split commit from master.
	# The above will generally only be the case in CI or if using a custom PR pulling script which
	# pulls the merge PR commit instead of just the PR branch.
	#
	# If the HEAD commit is not a merge then we diff HEAD with PR split commit from master. This is the case
	# when running from a local development PR branch
	#
	# The branching point hash retrieval logic is based on https://stackoverflow.com/a/12185115/3199106
	
	TRANSLATORS_TO_CHECK=""
	
	# Push to master
	if [ "${GITHUB_REF:-}" = "refs/heads/master" ]; then
		before_commit=$(jq -r '.before' $(echo $GITHUB_EVENT_PATH))
		TRANSLATORS_TO_CHECK=$(git diff $before_commit --name-only | { grep -e "^[^/]*.js$" || true; })
	# Pull request
	else
		# Gets parent commits. Either one or two hashes
		parent_commits=($(git show --no-patch --format="%P" HEAD))
		# Size of $parent_commits array
		num_parent_commits=${#parent_commits[@]}
		if [ $num_parent_commits -gt 1 ]; then
			first_parent=$(git rev-list --first-parent ^master HEAD^2 | tail -n1)
			branch_point=$(git rev-list "$first_parent^^!")
			TRANSLATORS_TO_CHECK=$(git diff HEAD^2 $branch_point --name-only | { grep -e "^[^/]*.js$" || true; })
		else
			first_parent=$(git rev-list --first-parent ^master HEAD | tail -n1)
			branch_point=$(git rev-list "$first_parent^^!")
			TRANSLATORS_TO_CHECK=$(git diff $branch_point --name-only | { grep -e "^[^/]*.js$" || true; })
		fi
	fi
}
