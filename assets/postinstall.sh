#!/usr/bin/env bash



mkdir -p "$HOME/.oresoftware/bash" || {
    echo "could not create oresoftware/bash dir."
    exit 1;
}


if [[ "$(uname -s)" == "Darwin" ]]; then

   if [ ! -f "$HOME/.oresoftware/bin/realpath" ]; then
      (
        curl --silent -o- https://raw.githubusercontent.com/oresoftware/realpath/master/assets/install.sh | bash || {
           echo "Could not install realpath on your system.";
           exit 1;
        }
      )
   fi
fi


cat "assets/shell.sh" > "$HOME/.oresoftware/bash/r2g.sh" || {
  echo "Could not create oresoftware/bash/r2g.sh file."
  exit 1;
}

cat "assets/completion.sh" > "$HOME/.oresoftware/bash/npp.completion.sh" || {
  echo "could not create oresoftware/bash/r2g.completion.sh file."
  exit 1;
}
