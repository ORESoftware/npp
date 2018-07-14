'use strict';

import log from '../../logger';
import chalk from 'chalk';
import residence = require('residence');
import {getFSMap, SearchResult, SearchResultMap} from "../../find-projects";
import async = require('async');
import {mapPaths} from "../../map-paths";
import {EVCb} from "../../index";
import options, {PublishOpts} from './cli-opts';
import * as path from "path";
const dashdash = require('dashdash');
import * as rl from 'readline';
import * as semver from 'semver';
const inquirer = require('inquirer');
import * as cp from 'child_process';
import * as assert from "assert";

log.info(chalk.blueBright(
  'running publish'
));

process.once('exit', code => {
  console.log();
  log.info('Run with --verbosity=x to see more information, if need be.');
  log.info('Exiting with code:', code);
  console.log();
});

const allowUnknown = process.argv.indexOf('--allow-unknown') > 0;
let opts: PublishOpts, parser = dashdash.createParser({options, allowUnknown});

try {
  opts = parser.parse(process.argv);
} catch (e) {
  log.error(chalk.magenta(' => CLI parsing error:'), chalk.magentaBright.bold(e.message));
  process.exit(1);
}

if (opts.help) {
  let help = parser.help({includeEnv: true}).trimRight();
  console.log('usage: npp publish [OPTIONS]\n' + 'options:\n' + help);
  process.exit(0);
}

const Table = require('cli-table');
const table = new Table({
  // colWidths: [200, 100, 100, 100, 100, 100, 100],
  head: ['Name', 'Local Version', 'NPM Registry Version', 'Current Branch', 'Clean?', 'Up-to-Date?', 'Path']
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
  primaryNPPFile = require(path.resolve(projectRoot + '/.npp.json'));
}
catch (err) {
  log.error('Could not load your primary project\'s .npp.json file.');
  throw err.message;
}

const searchRoots = primaryNPPFile.searchRoots;
const packages = primaryNPPFile.packages;
const promptColorFn = chalk.bgBlueBright.whiteBright.bold;

async.autoInject({

    mapPaths(cb: EVCb<any>) {
      mapPaths(searchRoots, cb);
    },

    getMap(mapPaths: Array<string>, cb: EVCb<SearchResultMap>) {
      getFSMap(mapPaths, opts, packages, cb);
    },

    confirmProjects(getMap: SearchResultMap, mapPaths: any, cb: EVCb<SearchResultMap>) {

      const clonedMap = Object.assign({}, getMap);

      if (Object.keys(clonedMap).length < 1) {
        return process.nextTick(cb, chalk.magenta("No relevant projects/packages were found on your fs, here were your original searchRoots: ") + chalk.magentaBright(searchRoots));
      }

      let allClean = true;
      let allUpToDateWithRemote = true;

      Object.keys(clonedMap).forEach(k => {
        const v = clonedMap[k];
        if (!v.upToDateWithRemote) {
          allUpToDateWithRemote = false;
        }
        if (!v.workingDirectoryClean) {
          allClean = false;
        }
        table.push(Object.values(v));
      });

      const str = table.toString().split('\n').map((v: string) => '  ' + v).join('\n');
      console.log(str);
      console.log();

      if (!allClean) {
        log.warn('Note that at least one package has working changes that have not been committed.');
      }

      if (!allUpToDateWithRemote) {
        log.warn('Note that at least one package has commits that have not made it to the remote.');
      }

      console.log();

      const prompt = rl.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      prompt.question(promptColorFn(' => Given the above table, are these the packages you wish to publish? (y/n) ') + ' ', (answer) => {

        prompt.close();

        if ((String(answer || '').trim().toLowerCase().startsWith('y'))) {
          console.log();
          log.info('Ok, we are going to choose a version next.');
          console.log();
          return cb(null, clonedMap);
        }

        cb(chalk.magenta('User needed to confirm that project list was ok, but the answer did not start with "y" or "Y"'));

      });

    },

    chooseNewVersion(confirmProjects: SearchResultMap, cb: EVCb<any>) {

      let oldestVersion = '0.0.0';
      let youngestVersion = '9999.99.999';
      let youngestPackageName = null;
      let oldestPackageName = null;

      const onVersionError = function (e: Error, name: string, path: string) {
        console.log();
        log.error(e.message);
        log.error('Looks like one of your projects has an invalid semver version in package.json.');
        log.error('You should mitigate that now, and then restart this process later.');
        log.error('The package name with the problem is:', chalk.magenta(name));
        log.error('The path to this package is:', chalk.magenta(path));
        process.exit(1);
      };

      Object.keys(confirmProjects).forEach(k => {
        const v = confirmProjects[k];

        try {
          if (semver.lte(v.localVersion, youngestVersion)) {
            youngestVersion = v.localVersion;
            youngestPackageName = v.name;
          }
        }
        catch (err) {
          onVersionError(err, v.name, v.path);
        }

        try {
          if (semver.gte(v.localVersion, oldestVersion)) {
            oldestVersion = v.localVersion;
            oldestPackageName = v.name;
          }
        }
        catch (err) {
          onVersionError(err, v.name, v.path);
        }

      });

      log.info('The package with the smallest version is:', youngestPackageName, 'with version:', chalk.magenta(youngestVersion));
      log.info('The package with the biggest version is:', oldestPackageName, 'with version:', chalk.magenta(oldestVersion));

      console.log();

      ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'].forEach(function (v) {
        log.info(
          `If you are bumping a ${chalk.bold(v)} version, npp recommends this version:`,
          chalk.blueBright.bold(semver.inc(oldestVersion, v as any, null, opts.release))
        );
      });

      (function runPrompt() {

        const prompt = rl.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        console.log();
        prompt.question(promptColorFn(' => Given the above version info, what version would you like to bump the projects/packages to? ') + ' ', (answer) => {

          prompt.close();

          try {

            if (semver.valid(answer)) {
              log.info('The following version is valid:', chalk.blueBright.bold(answer));
              log.info('We will use that version for all the packages in the tree.');
              console.log();
              return cb(null, answer);
            }

            throw 'Semver version was invalid for version: ' + answer;

          }
          catch (err) {
            log.warn(err);
            log.warn('Please try entering in a semver version again.');
            runPrompt();
          }

        });

      })();

    },

    choosePublishingOrder(chooseNewVersion: string, confirmProjects: SearchResultMap, cb: EVCb<Array<SearchResult>>) {

      const keys = Object.keys(confirmProjects);
      const list: Array<SearchResult> = [];

      (function ask() {

        inquirer.prompt([
          {
            type: 'list',
            name: 'nextPackage',
            message: promptColorFn(' => Choose the publishing order. Which package would you like to publish first/next? '),
            choices: keys
          }
        ])
        .then((answers: any) => {

          const k = answers.nextPackage;
          list.push(confirmProjects[k]);

          const index = keys.indexOf(k);
          keys.splice(index, 1);

          if (keys.length > 1) {
            rl.clearLine(process.stdout, 0);
            return ask();
          }

          list.push(confirmProjects[keys[0]]); // there is one remaining
          console.log();
          log.info(chalk.blueBright('Your packages will be published in the following order:'));
          list.map(v => v.name).forEach((v, i) => log.info(chalk.bold(String(i + 1)), chalk.cyan.bold(v)));
          cb(null, list);

        });

      })();

    },

    areYouReadyToPublish(choosePublishingOrder: Array<SearchResult>, cb: EVCb<any>) {

      console.log();

      const prompt = rl.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      prompt.question(promptColorFn(' => Are you ready to publish? (y/n) ') + ' ', answer => {

        prompt.close();

        if ((String(answer || '').trim().toLowerCase().startsWith('y'))) {
          return cb(null);
        }

        log.info(chalk.yellow('You need to use a phrase that starts with y/Y to contine on.'));
        log.info(chalk.yellow('Too bad things didnt work out, better luck next time.'));
        process.exit(1);

      });

    },

    runPublish(areYouReadyToPublish: any, choosePublishingOrder: Array<SearchResult>, cb: EVCb<any>) {

      async.eachLimit(choosePublishingOrder.slice(0), 1, (v, cb) => {

          const k = cp.spawn('bash');

          let pck = null, pkgJSONPath = path.resolve(v.path + '/package.json');

          try {
            pck = require(pkgJSONPath);
          }
          catch (err) {
            log.error('Could not load package.json file at path:', pkgJSONPath);
            return cb(err);
          }

          try {
            assert.strictEqual(pck.name, v.name, 'Package names do not match, this is an implementation error.');
          }
          catch (err) {
            return cb(err);
          }

          const cmd = [
            `cd ${v.path}`,
            ``

          ]
          .join(' && ');

          k.stdin.end(cmd);

          k.once('exit', code => {

            let err = code < 1 ? null : {
              'message': 'Could not run command in package root.',
              cmd,
              code,
              path: v.path,
              package: v.name
            };

            cb(err);

          });

        },
        cb);

    }

  },

  (err, results) => {

    if (err) {
      console.error();
      log.error(err);
      console.error();
      process.exit(1);
    }

    console.log();
    log.info(chalk.green.bold('All done, success.'));
    console.log();
    process.exit(0);

  });



