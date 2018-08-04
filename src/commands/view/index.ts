'use strict';

import log from '../../logger';
import chalk from 'chalk';
import residence = require('residence');
import {getFSMap, SearchResultMap} from "../../find-projects";
import async = require('async');
import {mapPaths} from "../../map-paths";
import {EVCb} from "../../index";
import options, {ViewOpts} from './cli-opts';
import * as path from "path";
import {getViewTable} from "../../tables";
const dashdash = require('dashdash');


log.info(chalk.blueBright(
  'running view'
));

process.once('exit', code => {
  console.log();
  log.info('Run with --verbosity=x to see more information, if need be.');
  log.info('Exiting with code:', code);
  console.log();
});



const allowUnknown = process.argv.indexOf('--allow-unknown') > 0;
let opts: ViewOpts,  parser = dashdash.createParser({options, allowUnknown});

try {
  opts = parser.parse(process.argv);
} catch (e) {
  log.error(chalk.magenta(' => CLI parsing error:'), chalk.magentaBright.bold(e.message));
  process.exit(1);
}

if (opts.help) {
  let help = parser.help({includeEnv: true}).trimRight();
  console.log('usage: npp view [OPTIONS]\n' + 'options:\n' + help);
  process.exit(0);
}

if(opts.view_all){
  opts.view_npm_registry = true;
  opts.view_packages_path = true;
}

opts.isView = true;

const viewTable = getViewTable(opts);
const Table = require('cli-table');
const table = new Table({
  // colWidths: [200, 100, 100, 100, 100, 100, 100],
  head: viewTable.map(v => v.header)
});



const cwd = process.cwd();
const projectRoot = residence.findProjectRoot(cwd);

if (!projectRoot) {
  log.error( chalk.redBright('Could not find project root given current working directory:') , chalk.blueBright(cwd));
  log.error(chalk.redBright('NPP looks for your project root based off the nearest package.json file, by walking down the fs tree. You might be missing a package.json file.'));
  process.exit(1);
}

let primaryNPPFile = null;

try {
  primaryNPPFile = require(path.resolve(projectRoot + '/.npp.root.json'));
}
catch (err) {
  log.error('Could not load your primary project\'s .npp.json file.');
  throw err.message;
}

const searchRoots = primaryNPPFile.searchRoots;
const packages = primaryNPPFile.packages;

async.autoInject({

    mapPaths(cb: EVCb<any>) {
      mapPaths(searchRoots, cb);
    },

    getMap(mapPaths: Array<string>, cb: EVCb<any>) {
      getFSMap(mapPaths, opts, packages, cb);
    }

  },

  (err, results) => {

    if (err) {
      throw err;
    }

    const map = results.getMap as SearchResultMap;

    Object.keys(map).forEach(k => {

      const value : any = map[k];
      table.push(viewTable.map(v => {

        if(!(v.value in value)){
          log.debug('map value does not have this property:', v.value);
          log.debug('The map looks like:', value);
        }
        return v.value in value? value[v.value] : '(missing data)'
      }));

    });

    const str = table.toString().split('\n').map((v: string) => '  ' + v).join('\n');
    console.log(str);

  });



