#!/usr/bin/env bash


branch="$1";
integration="$2"

branch_name="$(git rev-parse --abbrev-ref "$branch")";
merge_base="$(git merge-base "$branch" "$integration")";
merge_source_current_commit="$(git rev-parse "$branch")";

result="";
code="";

if [ "$merge_base" != "$merge_source_current_commit" ]; then
    result="unmerged"
    code=0;  ###  <<<<<<<<<<<<<<<<<< use code 1 in the future perhaps
else
    result="merged"
    code=0;
fi

json_stdio `cat <<EOF
  {"branch":"${branch_name}","value":"${result}"}
EOF`

# exit with 1 if unmerged
exit "$code"

