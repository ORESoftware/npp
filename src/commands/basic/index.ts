'use strict';

process.once('exit', code => {
  console.log();
  log.info('Run with --verbosity=x to see more information, if need be.');
  log.info('Exiting with code:', code);
  console.log();
});


import log from '../../logger';
import chalk from 'chalk';
import * as nppUtils from '../../utils';

log.info(chalk.blueBright(
  'running basic'
));

import initOpts from '../init/cli-opts';
import publishOpts from '../publish/cli-opts';
import viewOpts, {ViewOpts} from '../view/cli-opts';
import options, {BasicCliOpts} from './cli-opts';

const dashdash = require('dashdash');


const allowUnknown = process.argv.indexOf('--allow-unknown') > 0;
let opts: BasicCliOpts,  parser = dashdash.createParser({options, allowUnknown});

try {
  opts  = parser.parse(process.argv);
} catch (e) {
  log.error(chalk.magenta(' => CLI parsing error:'), chalk.magentaBright.bold(e.message));
  process.exit(1);
}

console.log('opts:', opts);

if (opts.help) {
  let help = parser.help({includeEnv: true}).trimRight();
  console.log();
  console.log('To get help with npp view, use:', chalk.magenta('npp view --help'));
  console.log('To get help with npp publish, use:', chalk.magenta('npp publish --help'));
  console.log('To get help with npp init, use:', chalk.magenta('npp init --help'));
  console.log();
  console.log('usage: npp [OPTIONS]\n' + 'options:\n' + help);
  process.exit(0);
}

if (opts.bash_completion) {
  
  const allOpts = nppUtils.flattenDeep([ initOpts, viewOpts, publishOpts]);
  
  let generatedBashCode = dashdash.bashCompletionFromOptions({
    name: 'npp',
    options: allOpts,
    includeHidden: false
  });
  
  console.log(generatedBashCode);
  process.exit(0);
}

log.warn('No option matched.');
