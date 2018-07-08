'use strict';

import log from '../../logger';
import chalk from 'chalk';

log.info(chalk.blueBright(
  'running view'
));

const Table = require('cli-table');
const table = new Table({
  // colWidths: [200, 100, 100, 100, 100, 100, 100],
  head: ['           Author             ', 'Files Modified', 'Commits', 'Added Lines', 'Removed Lines', 'Changes', 'Overall']
});

const flattenDeep = function (a: Array<any>): Array<any> {
  return a.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
};
