#!/usr/bin/env bash


branch="$1";
integration="$2"

branch_name="$(git rev-parse --abbrev-ref "$branch")";
merge_base="$(git merge-base "$branch" "$integration")";
merge_source_current_commit="$(git rev-parse "$branch")";

result="";

if [ "$merge_base" != "$merge_source_current_commit" ]; then
    result="unmerged"
else
    result="merged"
fi

json_stdio `cat <<EOF
  {"branch":"${branch_name}","value":"${result}"}
EOF`


