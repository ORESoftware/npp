'use strict';

export default [
  
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
    names: ['verbosity', 'v'],
    type: 'integer',
    help: 'Verbosity level, 1-3 inclusive.'
  },
  {
    names: ['allow-unknown'],
    type: 'bool',
    help: 'Allow unknown arguments to the command line.',
  },
  {
    names: ['bash-completion', 'completion'],
    type: 'bool',
    help: 'Generate bash completion code (written to stdout).',
  }

]

export interface BasicCliOpts {
  bash_completion: boolean,
  allow_unknown: boolean,
  verbosity: number,
  help: boolean,
  version: string
}
