#!/usr/bin/env bash


if ! type -f "typescript-json-schema"; then
    npm i -g typescript-json-schema || {
      echo "Could not install tjs...";
      exit 1;
    }
fi


# to use this redirect output to assets/nlu.schema.json

typescript-json-schema  --ignoreErrors  'src/index.ts' NppJSONRootConf > assets/schema/npp.root.json
typescript-json-schema  --ignoreErrors  'src/index.ts' NppJSONConf > assets/schema/npp.json
