'use strict';

const options =  [

  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['force', 'f'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['verbosity', 'v'],
    type: 'integer',
    help: 'Verbosity level, 1-3 inclusive.'
  },
  {
    names: ['delete', 'D'],
    type: 'bool',
    help: 'Delete merged branches.'
  },
  {
    names: ['view-npm-registry','view-registry'],
    type: 'bool',
    help: 'See/view data from the NPM registry.'
  },
  {
    names: ['view-packages-path','view-path'],
    type: 'bool',
    help: 'See/view absolute fs path to each package.'
  },
  {
    names: ['view-git-stash', 'view-stash'],
    type: 'bool',
    help: 'See results from the "git stash show" command for each git repo.'
  },
  {
    names: ['view-all', 'all', 'a'],
    type: 'bool',
    help: 'See/view all data.'
  },
  {
    names: ['release'],
    type: 'string',
    help: 'Either "beta", "alpha" or "rc".',
    default: ''
  },
  {
    names: ['allow-unknown'],
    type: 'bool',
    help: 'Allow unknown arguments to the command line.',
  }

];


export interface PublishOpts {
  force:boolean,
  help: boolean,
  verbosity: number,
  allow_unknown: boolean,
  release: string,
  isPublish?: boolean
}

export default options;
