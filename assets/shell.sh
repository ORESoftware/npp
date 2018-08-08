#!/usr/bin/env bash


npp(){

  if ! type -f npp &> /dev/null || ! which npp &> /dev/null; then

    echo -e "Installing the '@oresoftware/r2g' NPM package globally..." >&2;

    npm i -s -g '@oresoftware/npp' || {

      echo -e "Could not install the '@oresoftware/npp' NPM package globally." >&2;
      echo -e "Check your user permissions to install global NPM packages." >&2;
      return 1;

    }

 fi

 command npp "$@";

}


export -f npp;
