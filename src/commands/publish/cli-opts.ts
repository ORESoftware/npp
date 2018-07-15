'use strict';

const options =  [

  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['verbosity', 'v'],
    type: 'integer',
    help: 'Verbosity level, 1-3 inclusive.'
  },
  {
    names: ['view-npm-registry','view-registry'],
    type: 'bool',
    help: 'See data from the NPM registry.'
  },
  {
    names: ['view-packages-path','view-path'],
    type: 'bool',
    help: 'See data from the NPM registry.'
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
  help: boolean,
  verbosity: number,
  allow_unknown: boolean,
  release: string,
  isPublish?: boolean
}

export default options;
