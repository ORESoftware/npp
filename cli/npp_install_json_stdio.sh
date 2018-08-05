#!/usr/bin/env bash


if ! type -f json_stdio &> /dev/null || ! which json_stdio &> /dev/null; then
  npm i -g -s "json-stdio@latest" || {
    echo "Could not install json-stdio from NPM registry.";
    exit 1;
  }
fi
