'use strict';

import log from '../../logger';
import chalk from 'chalk';
import residence = require('residence');
import {EVCallback, getFSMap} from "../../find-projects";
import async = require('async');
import {mapPaths} from "../../map-paths";

log.info(chalk.blueBright(
  'running view'
));

const Table = require('cli-table');
const table = new Table({
  // colWidths: [200, 100, 100, 100, 100, 100, 100],

  head: ['Name', 'Version', 'Current Branch', 'Clean?', 'Up-to-Date?', 'Path']
});

const flattenDeep = function (a: Array<any>): Array<any> {
  return a.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
};

const cwd = process.cwd();
const projectRoot = residence.findProjectRoot(cwd);

if (!projectRoot) {
  throw 'Could not find project root given current working directory: ' + chalk.blueBright(cwd);
}

let primaryNPPFile = null;

try {
  primaryNPPFile = require(projectRoot + '/.npp.json');
}
catch (err) {
  log.error('Could not load your primary project\'s .npp.json file.');
  throw err.message;
}

const searchRoot = primaryNPPFile.searchRoot;
const packages = primaryNPPFile.packages;
log.info('packages:', packages);

async.autoInject({

  mapPaths(cb: EVCallback) {
    mapPaths([searchRoot], cb);
  },

  getMap(mapPaths: Array<string>, cb: EVCallback) {
    console.log('map-paths:', mapPaths);
    getFSMap({}, mapPaths[0], packages, cb);
  }

}, (err, results) => {

  if (err) {
    throw err;
  }

  const map = results.getMap;

  Object.keys(map).forEach(k => {

    const v = map[k];
    table.push(Object.values(v));

  });

  const str = table.toString().split('\n').map((v: string) => '  ' + v).join('\n');
  console.log(str);

});



