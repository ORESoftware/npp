#!/usr/bin/env bash

### we use this bash file instead of a dist/.js file, because of this problem:
### https://stackoverflow.com/questions/50616253/how-to-resolve-chicken-egg-situation-with-tsc-and-npm-install

dir_name="$(dirname "$0")"
read_link="$(readlink "$0")";
exec_dir="$(dirname $(dirname "$read_link"))";
my_path="$dir_name/$exec_dir";
basic_path="$(cd $(dirname ${my_path}) && pwd)/$(basename ${my_path})"
commands="$basic_path/dist/commands"


### there is an extradinary amount of magic required to get a bash script
### to properly reference an adjacent .js file
### if the above can be simplified, please lmk, but the above is currently very necessary.

### one value add here of using a bash script, is that we can easily install any missing CLI dependencies
### or set env variables as needed


first_arg="$1";


# make sure json_stdio is installed
npp_install_json_stdio


if [ "$first_arg" == "view" ] || [ "$first_arg" == "v" ]; then

  # view table of projects
  shift 1;
  node "$commands/view" "$@"

elif [ "$first_arg" == "publish" ] || [ "$first_arg" == "p" ]; then

  shift 1;
  node "$commands/publish" "$@"

else

  node "$commands/basic" "$@"

fi


