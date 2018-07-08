'use strict';

import chalk from "chalk";
const isDebug = process.env.npp_is_debug === 'yes';

export const log = {
  info: console.log.bind(console, chalk.gray('[npp info]')),
  warning: console.error.bind(console, chalk.bold.yellow.bold('[npp warn]')),
  warn: console.error.bind(console, chalk.bold.magenta.bold('[npp warn]')),
  error: console.error.bind(console, chalk.redBright.bold('[npp error]')),
  debug: function (...args: any[]) {
    isDebug && console.log('[npp]', ...arguments);
  }
};

export default log;
