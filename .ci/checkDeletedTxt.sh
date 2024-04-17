#!/bin/bash

SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
. "$SCRIPT_DIR/helper.sh"
cd "$SCRIPT_DIR"

MASTER="master"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$BRANCH" = "$MASTER" ]];then
    echo "${color_warn}skip${color_reset} - Can only check deleted.txt when not on '$MASTER' branch"
    exit 0
fi

if ! git branch -a | grep -q "$MASTER"; then
    echo "${color_warn}skip${color_reset} - Can only check deleted.txt when '$MASTER' branch is also available for comparison"
    exit 0
fi

main() {
    local IFS=$'\n'
    declare -a deletions=()
    local failed=0
    # Find all deleted js files
    deletions+=($(git diff-index --diff-filter=D --name-only --find-renames $MASTER|grep -v '\.ci'|grep 'js$'))
    if (( ${#deletions[@]} > 0 ));then
        for f in "${deletions[@]}";do
            local id=$(git show $MASTER:"$f" | get_translator_id)
            if ! grep -qF "$id" '../deleted.txt';then
                echo "${color_notok}not ok${color_reset} - $id ($f) should be added to deleted.txt"
                (( failed += 1))
            fi
        done
        curVersion=$(head -n1 "../deleted.txt"|grep -o '[0-9]\+')
        origVersion=$(git show "$MASTER:deleted.txt"|head -n1|grep -o '[0-9]\+')
        if (( curVersion <= origVersion ));then
            echo "${color_notok}not ok${color_reset} - version in deleted.txt needs to be increased"
            (( failed += 1))
        fi
    fi
    if [[ "$failed" = 0 ]];then
        echo "${color_ok}ok${color_reset} - deleted.txt"
    fi
    exit $failed
}
main
