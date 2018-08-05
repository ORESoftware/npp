'use strict';

const options = [
  
  {
    names: ['version', 'vn'],
    type: 'bool',
    help: 'Print tool version and exit.'
  },
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['view-npm-registry', 'view-registry'],
    type: 'bool',
    help: 'See data from the NPM registry.'
  },
  {
    names: ['view-packages-path', 'view-full-path', 'view-path'],
    type: 'bool',
    help: 'See/view absolute fs path to each package.'
  },
  {
    names: ['view-all', 'all'],
    type: 'bool',
    help: 'See data from the NPM registry.'
  },
  {
    names: ['view-git-stash', 'view-stash'],
    type: 'bool',
    help: 'See results from the "git stash show" command for each git repo.'
  },
  {
    names: ['verbosity', 'v'],
    type: 'integer',
    help: 'Verbosity level, 1-3 inclusive.'
  },
  {
    names: ['allow-unknown'],
    type: 'bool',
    help: 'Allow unknown arguments to the command line.',
  }

];

export default options;

export type Opts = typeof options;

export interface ViewOpts {
  help: boolean,
  isView: boolean,
  view_all: boolean,
  view_packages_path: boolean,
  view_npm_registry: boolean
}
