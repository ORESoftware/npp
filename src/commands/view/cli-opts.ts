'use strict';


const options = [

  {
    names: ['version','vn'],
    type: 'bool',
    help: 'Print tool version and exit.'
  },
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['registry'],
    type: 'bool',
    help: 'See data from the NPM registry.'
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
  help: boolean
}
