#!/usr/bin/env bash

true && ( true ) || { echo "Command failed"; echo "master-1"; exit 1; } && echo "master-2"
