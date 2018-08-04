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
import * as fs from 'fs';
import {getViewTable} from "../../tables";
import pt from 'prepend-transform';
import Ajv = require('ajv');

const nppRootSchema = require('../../../assets/schema/npp.root.json');
const nppSchema = require('../../../assets/schema/npp.json');

log.info(chalk.blueBright(
  'running publish'
));

process.once('exit', code => {
  console.log();
  log.info('Run with --verbosity=x to see more information, if need be.');
  log.info('Exiting with code:', code);
  console.log();
});

export interface ReleaseInfo {
  releaseName: string,
  gitRemoteURL: string
}

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

// so we know we are publishing, not just viewing
opts.isPublish = true;

const viewTable = getViewTable(opts);

import Table = require('cli-table');
import {flattenDeep} from "../../utils";
import * as util from "util";

const table = new Table({
  // colWidths: [200, 100, 100, 100, 100, 100, 100],
  colors: false,
  head: viewTable.map(v => v.header)
});

const cwd = process.cwd();
const projectRoot = residence.findProjectRoot(cwd, '.npp.root.json');
if (!projectRoot) {
  log.error(chalk.redBright('Could not find an .npp.root.json file within your current working directory.'));
  process.exit(1);
}

let rootNPPFile = null;

try {
  rootNPPFile = require(path.resolve(projectRoot + '/.npp.root.json'));
}
catch (err) {
  log.error('Could not load an .npp.root.json file.');
  throw err.message;
}

{
  const ajv = new Ajv({allErrors: false}); // options can be passed, e.g. {allErrors: true}
  const validate = ajv.compile(nppRootSchema);
  try {
    const valid = validate(rootNPPFile);
    if (!valid) {
      throw validate.errors;
    }
  }
  catch (err) {
    log.error(err.message);
    log.error('Your .npp.root.json file is not valid - it does not match the validation schema.');
    log.error('Your .npp.root.json is as follows:', rootNPPFile);
    log.error('And the schema is like so:', nppRootSchema);
    process.exit(1);
  }
}

const searchRoots = flattenDeep([rootNPPFile.searchRoots]).map(v => String(v || '').trim()).filter(Boolean);
const packages = rootNPPFile.packages;
const promptColorFn = chalk.bgBlueBright.whiteBright.bold;

async.autoInject({
    
    mapPaths(cb: EVCb<any>) {
      mapPaths(searchRoots, projectRoot, cb);
    },
    
    getMap(mapPaths: Array<string>, cb: EVCb<SearchResultMap>) {
      getFSMap(mapPaths, opts, packages, cb);
    },
    
    confirmProjects(getMap: SearchResultMap, mapPaths: any, cb: EVCb<SearchResultMap>) {
      
      const clonedMap = Object.assign({}, getMap);
      
      if (Object.keys(clonedMap).length < 1) {
        return process.nextTick(cb,
          chalk.magenta("No relevant projects/packages were found on your fs, here were your original searchRoots: ") + chalk.magentaBright(util.inspect(searchRoots)));
      }
      
      let allClean = true;
      let allUpToDateWithRemote = true;
      
      const ajv = new Ajv({allErrors: false}); // options can be passed, e.g. {allErrors: true}
      const validate = ajv.compile(nppSchema);
      
      const errors: Array<string> = [];
      
      Object.keys(clonedMap).forEach(k => {
        
        const value = clonedMap[k];
        
        if (!value.nppJSON) {
          console.error();
          log.error('We need to know what vcs you are using in project:', chalk.blueBright(value.path));
          log.error('Please add vcs information to the .npp.json file here:', chalk.blueBright(path.resolve(value.path + '/.npp.json')));
          log.error('To see the structure of a valid .npp.json file and the vcs property, see: https://github.com/ORESoftware/npp/blob/master/src/index.ts');
          process.exit(1);
        }
        
        try {
          const valid = validate(value.nppJSON);
          if (!valid) {
            throw validate.errors;
          }
        }
        catch (err) {
          log.error(err.message);
          log.error('Your .npp.root.json file is not valid - it does not match the validation schema.');
          log.error('Your .npp.json is as follows:', value.nppJSON);
          log.error('And the schema is like so:', nppSchema);
          process.exit(1);
        }
        
        if (value.nppJSON.vcsType !== 'git') {
          console.error();
          log.error('Currenly NPP only supports Git, as far as version control. The following package declared a VCS other than git:', value.path);
          log.error('If this was a mistake, you can update your .npp.json file here:', path.resolve(value.path + '/.npp.json'));
          process.exit(1);
        }
        
        if (!value.upToDateWithRemote) {
          allUpToDateWithRemote = false;
        }
        
        if (!value.workingDirectoryClean) {
          errors.push('Working directory is not clean for package at path: ' + chalk.blueBright(value.path));
          allClean = false;
        }
        
        // table.push(viewTable.map(v => (value as any)[v.value]));
        
        table.push(viewTable.map(v => {
          
          if (!(v.value in value)) {
            log.debug('map value does not have this property:', v.value);
            log.debug('The map looks like:', value);
          }
          
          return v.value in value ? (value as any)[v.value] : '(missing data)'
        }));
        
      });
      
      const str = table.toString().split('\n').map((v: string) => '  ' + v).join('\n');
      console.log(str);
      console.log();
      
      if (errors.length) {
        errors.forEach(v => log.error(v));
        if (!opts.force) {
          console.log('\n', chalk.bgRedBright.bold.whiteBright(' => Please resolve these problems and then retry publishing.'), '\n');
          process.exit(1);
        }
      }
      
      if (!allClean) {
        log.warn('Note that at least one package has working changes that have not been committed.');
        if (!opts.force) {
          process.exit(1);
        }
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
    
    startPublish(areYouReadyToPublish: any, chooseNewVersion: string, choosePublishingOrder: Array<SearchResult>, cb: EVCb<any>) {
      
      const publishArray = choosePublishingOrder.slice(0);
      
      async.mapLimit(publishArray, 1, (v, cb) => {
          
          const k = cp.spawn('bash');
          log.debug('Checking out release branch in path:', v.path);
          
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
          
          const releaseName = v.releaseBranchName = `${process.env.USER}/npp_tool/release/${Date.now()}`;
          
          const cmd = [
            `cd ${v.path}`,
            `git fetch origin master`, // fetch the integration branch first
            `git checkout --no-track -b "${releaseName}" "remotes/origin/master"` //  `git checkout "${releaseName}" HEAD`,
          ]
            .join(' && ');
          
          k.stderr.pipe(pt(chalk.yellow.bold(`[${v.name}]: `))).pipe(process.stderr);
          
          k.stdin.end(cmd);
          
          k.once('exit', code => {
            
            if (code > 0) {
              return cb({
                'message': 'Could not run command in package root / could not checkout release branch from the current branch.',
                cmd,
                code,
                path: v.path,
                packageName: v.name
              });
            }
            
            log.debug('Successfully checked out release branch for path:', v.path);
            log.debug('Now we are modifying the package.json file in that path to reflect the version bump.');
            
            fs.readFile(pkgJSONPath, (err, data) => {
              
              if (err) {
                return cb(err);
              }
              
              let pjson: any = null;
              
              try {
                pjson = JSON.parse(String(data));
              }
              catch (err) {
                log.error('Could not parse package.json file at path:', v.path);
                return cb(err);
              }
              
              pjson.version = chooseNewVersion;
              
              ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].forEach(d => {
                Object.keys(packages).forEach(v => {
                  if (pjson[d] && typeof pjson[d] === 'object') {
                    if (v in pjson[d]) {
                      pjson[d][v] = chooseNewVersion;
                    }
                  }
                });
              });
              
              let stringified: string = null;
              
              try {
                stringified = JSON.stringify(pjson, null, 2);
              }
              catch (err) {
                log.error('Could not call JSON.stringify on:', pjson);
                return cb(err);
              }
              
              fs.writeFile(pkgJSONPath, stringified, err => {
                
                if (err) {
                  log.error('Could not write to this path:', pkgJSONPath);
                  log.error('The data we were trying to write to the path was:', stringified);
                  return cb(err);
                }
                
                log.info('Successfully updated package.json at path:', v.path);
                
                cb(null, v);
                
              });
              
            });
            
          });
        },
        cb);
      
    },
    
    modifyReleaseBranches(startPublish: Array<SearchResult>, chooseNewVersion: string, cb: EVCb<Array<ReleaseInfo>>) {
      
      async.mapLimit(startPublish, 1, (v, cb) => {
        
        console.log();
        const releaseName = v.releaseBranchName;
        const k = cp.spawn('bash');
        
        log.debug('Checking to see if we can merge the release branch into master for path:', v.path);
        
        const tempBranch = `${process.env.USER}/npp_tool/feature/${Date.now()}`;
        const masterCopy = `npp_tool/master_copy`;
        const masterBranch = 'remotes/origin/master';
        
        let subshell = [
          `git checkout "${releaseName}"`,
          `( git branch -D -f "${tempBranch}" &> /dev/null || echo "" )`,
          `git add .`,
          `git commit -am "NPP tool has modified/updated package.json"`,
          `git fetch origin`,
          `( git branch -D -f "${masterCopy}" &> /dev/null || echo "" )`,
          `git checkout --no-track -b "${masterCopy}" "${masterBranch}"`,
          `git merge --no-commit -m "Checking to see if release branch can be merged into master." "${releaseName}"`,
          `git checkout ${releaseName} -f`,
          // `git tag ${chooseNewVersion}`,
          `git push --follow-tags -u origin ${releaseName}`
        ]
          .join(' && ');
        
        const safeCheckout = ` git checkout -b --no-track "${tempBranch}" "${masterBranch}" `;
        
        // always checkout the integration branch again, at the end
        const cmd = `cd ${v.path} && ( ${subshell} ) || { echo "Command failed"; ${safeCheckout}; exit 1; } && ${safeCheckout};`;
        
        k.stdin.end(cmd);
        k.stderr.pipe(pt(chalk.yellow.bold(`[${v.name}]: `))).pipe(process.stderr);
        
        k.once('exit', code => {
          
          if (code > 0) {
            
            log.error('Could not merge release branch into master branch for path:', v.path);
            log.error('Please inspect your git repo at path:', v.path);
            
            return cb({
              code,
              message: 'Could not run command at path: ' + v.path,
              cmd,
              path: v.path,
              packageName: v.name
            });
          }
          
          log.info('The release branch should be mergeable to the master branch at path:', v.path);
          
          cb(null, {
            releaseName,
            gitRemoteURL: 'dummy value fix later',
          });
          
        });
        
      }, cb);
      
    },
    
    mergeReleaseBranches(modifyReleaseBranches: Array<ReleaseInfo>, cb: EVCb<any>) {
      
      console.log();
      
      modifyReleaseBranches.forEach(v => {
        log.info('Release branch:', v.releaseName, 'at remote:', v.gitRemoteURL);
      });
      
      console.log();
      
      // the user must merge the release branches into master, before we actually publish to NPM
      const prompt = rl.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      prompt.question('Your release branches have all been created at the above locations. ' +
        'Please merge them all into their respective master branches. That might take you some time, that is OK. To contine hit return.', (answer) => {
        prompt.close();
        cb(null);
      });
      
    }
    
  },
  
  (err: any, results) => {
    
    if (err) {
      console.error();
      log.error(chalk.magenta(err.message || err));
      console.error();
      process.exit(1);
    }
    
    console.log();
    log.info(chalk.green.bold('All done, success.'));
    console.log();
    process.exit(0);
    
  });



