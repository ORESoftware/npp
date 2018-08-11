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
import * as stdio from 'json-stdio';

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
  releaseName: string
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
import {assertString, flattenDeep} from "../../utils";
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
        
        const mapv = clonedMap[k];
        const integrationBranchValue = mapv.integrationBranch;
        const currentBranchValue = mapv.currentBranch;
        
        if (!integrationBranchValue.nppJSON) {
          console.error();
          log.error('We need to know what vcs you are using in project:', chalk.blueBright(mapv.path));
          log.error('Please add vcs information to the .npp.json file here:', chalk.blueBright(path.resolve(mapv.path + '/.npp.json')));
          log.error('To see the structure of a valid .npp.json file and the vcs property, see: https://github.com/ORESoftware/npp/blob/master/src/index.ts');
          process.exit(1);
        }
        
        try {
          assert.deepStrictEqual(integrationBranchValue.packageJSON, currentBranchValue.packageJSON);
        }
        catch (err) {
          log.warn(
            'The package.json file in your current branch differs from the integration branch =>',
            chalk.magenta(err.message)
          );
        }
        
        try {
          assert.deepStrictEqual(integrationBranchValue.packageJSON, currentBranchValue.packageJSON);
        }
        catch (err) {
          log.warn(
            'The .npp.json file in your current branch differs from the integration branch.',
            chalk.magenta(err.message)
          );
        }
        
        try {
          const valid = validate(integrationBranchValue.nppJSON);
          if (!valid) {
            throw validate.errors;
          }
        }
        catch (err) {
          log.error(err.message);
          log.error('Your .npp.root.json file is not valid - it does not match the validation schema.');
          log.error('Your .npp.json is as follows:', integrationBranchValue.nppJSON);
          log.error('And the schema is like so:', nppSchema);
          process.exit(1);
        }
        
        if (!(integrationBranchValue.nppJSON && integrationBranchValue.nppJSON.vcsType === 'git')) {
          console.error();
          log.error('Currenly NPP only supports Git, as far as version control. The following package declared a VCS other than git:', mapv.path);
          log.error('If this was a mistake, you can update your .npp.json file here:', path.resolve(mapv.path + '/.npp.json'));
          process.exit(1);
        }
        
        if (!integrationBranchValue.upToDateWithRemote) {
          allUpToDateWithRemote = false;
        }
        
        if (!integrationBranchValue.workingDirectoryClean) {
          errors.push('Working directory is not clean for package at path: ' + chalk.blueBright(mapv.path));
          allClean = false;
        }
        
        // table.push(viewTable.map(v => (value as any)[v.value]));
        
        table.push(viewTable.map(v => {
          
          if (!(v.value in mapv)) {
            log.debug('map value does not have this property:', v.value);
            log.debug('The map looks like:', mapv);
          }
          
          return v.value in mapv ? (mapv as any)[v.value] : '(missing data)'
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
        log.error('The package packageName with the problem is:', chalk.magenta(name));
        log.error('The path to this package is:', chalk.magenta(path));
        process.exit(1);
      };
      
      Object.keys(confirmProjects).forEach(k => {
        const proj = confirmProjects[k];
        const v = proj.integrationBranch;
        
        try {
          if (semver.lte(v.localVersion, youngestVersion)) {
            youngestVersion = v.localVersion;
            youngestPackageName = proj.name;
          }
        }
        catch (err) {
          onVersionError(err, proj.name, proj.path);
        }
        
        try {
          if (semver.gte(v.localVersion, oldestVersion)) {
            oldestVersion = v.localVersion;
            oldestPackageName = proj.name;
          }
        }
        catch (err) {
          onVersionError(err, proj.name, proj.path);
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
    
    areYouReadyToCraftReleaseBranches(choosePublishingOrder: Array<SearchResult>, cb: EVCb<any>) {
      
      console.log();
      
      const prompt = rl.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      prompt.question(promptColorFn(' => Are you ready to craft release branches? (y/n) ') + ' ', answer => {
        
        prompt.close();
        
        if ((String(answer || '').trim().toLowerCase().startsWith('y'))) {
          return cb(null);
        }
        
        log.info(chalk.yellow('You need to use a phrase that starts with y/Y to contine on.'));
        log.info(chalk.yellow('Too bad things didnt work out, better luck next time.'));
        process.exit(1);
        
      });
      
    },
    
    startPublish(areYouReadyToCraftReleaseBranches: any, chooseNewVersion: string, choosePublishingOrder: Array<SearchResult>, cb: EVCb<any>) {
      
      const publishArray = choosePublishingOrder.slice(0);
      
      async.mapLimit(publishArray, 3, (v, cb) => {
    
          const ib = v.integrationBranch.branchName;
    
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
          
          const releaseName = v.releaseBranchName = `${process.env.USER}/npp_tool/release/${String(Date.now()).slice(0, -3)}`;
          
          const cmd = [
            `cd ${v.path}`,
            `git fetch origin master`, // fetch the integration branch first
            `git branch --no-track "${releaseName}" "${ib}"`, //  `git checkout "${releaseName}" HEAD`,
            `git checkout "${releaseName}"`
          ]
            .join(' && ');
          
          k.stderr.pipe(pt(chalk.yellow.bold(`${v.name}: `))).pipe(process.stderr);
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
    
    modifyReleaseBranches(startPublish: Array<SearchResult>, chooseNewVersion: string, cb: EVCb<Array<SearchResult>>) {
      
      async.mapLimit(startPublish, 1, (v, cb) => {
        
        console.log();
        const releaseName = v.releaseBranchName;
        const k = cp.spawn('bash');
        
        log.debug('Checking to see if we can merge the release branch into master for path:', v.path);
        
        const tempBranch = v.tempFeatureBranch = `${process.env.USER}/npp_tool/feature/${String(Date.now()).slice(0, -3)}`;
        const masterCopy = `npp_tool/master_copy`;
        const masterBranch = v.masterBranch.branchName; // 'remotes/origin/master';
        const integrationBranch = v.integrationBranch.branchName; // 'remotes/origin/master';
        
        let subshell = [
          `git fetch origin`,
          `git checkout "${releaseName}"`,
          `( git branch -D -f "${tempBranch}" &> /dev/null || echo "" )`,
          `git add .`,
          `git commit -am "NPP tool has modified/updated package.json"`,
          `( git branch -D -f "${masterCopy}" &> /dev/null || echo "" )`,
          `git branch --no-track "${masterCopy}" "${masterBranch}"`,
          `git checkout "${masterCopy}"`,
          `git merge --no-commit -m "Checking to see if release branch can be merged into master." "${releaseName}"`,
          `git checkout ${releaseName} -f`,
          // `git tag ${chooseNewVersion}`,
          `git push --follow-tags -u origin ${releaseName}`
        ]
          .join(' && ');
        
        const safeCheckout = ` git branch "${tempBranch}" "${integrationBranch}"; git checkout "${tempBranch}"; git push -u origin ${tempBranch}`;
        
        // always checkout the integration branch again, at the end
        const cmd = `cd ${v.path} && ( ${subshell} ) || { echo "Command failed"; ${safeCheckout}; exit 1; } && ${safeCheckout};`;
        
        k.stdin.end(cmd);
        k.stderr.pipe(pt(chalk.yellow.bold(`${v.name}: `))).pipe(process.stderr);
        
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
          console.log();
          
          // the user must merge the release branches into master, before we actually publish to NPM
          const prompt = rl.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          
          let url: string = null;
          
          try{
            url = assertString(v.integrationBranch.nppJSON.urlToRemoteRepo);
          }
          catch(err){
            try{
              url = assertString(v.integrationBranch.packageJSON.homepage);
            }
            catch(err){
              try{
                url = assertString(v.integrationBranch.packageJSON.bugs.url);
                url = url.replace(/\/issues$/, '');  // if ends in /issues, remote that part
              }
              catch(err){
                try{
                  url = assertString(v.integrationBranch.packageJSON.repository.url);
                  url = url.replace(/.*(?=http)/,'');  // remove anything that does not start with http
                  url = url.replace(/\.git$/, '');  // if ends in .git, remote that part
                }
                catch(err){
                  log.warn('Could not grab www url for package:', chalk.magenta(v.name));
                }
              }
            }
          }
          
          url = url || `(no url to the remote repo for package "${v.name}" could be determined).`;
          
          prompt.question(promptColorFn(
            [`Your release branch for repo "${chalk.bold(v.name)}" has been pushed. Merge it on the remote manually.`,
              `${url}`,
              `To contine hit return.`
            ].join('\n')
          ) + ' ',
            (answer) => {
              prompt.close();
              cb(null, v);
            });
          
        });
        
      }, cb);
      
    },
    
    areYouReadyToPublish(modifyReleaseBranches: Array<SearchResult>, cb: EVCb<any>) {
      
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
    
    publish(areYouReadyToPublish: any, modifyReleaseBranches: Array<SearchResult>, cb: EVCb<Array<'foo'>>) {
      
      const publish = (releaseName: string, tempBranch: string, pth: string, name: string, fullIntegrationBranch: string, cb: EVCb<'foo'>) => {
        
        console.log();
        const k = cp.spawn('bash');
        
        const integrationBranch =  String(fullIntegrationBranch).split('/').map(v => String(v || '')).filter(Boolean).pop();  // 'master';
        
        let subshell = [
          `git fetch origin ${integrationBranch}`,
          `git checkout "${releaseName}"`,
          // `git pull`, // the user might delete the release branches on the remote
          `npm publish`,
        ]
          .join(' && ');
        
        const safeCheckout = ` git checkout "${tempBranch}" -f; git merge ${fullIntegrationBranch}`;
        
        // always checkout the integration branch again, at the end
        const cmd = `cd ${pth} && ( ${subshell} ) || { echo "Command failed"; ${safeCheckout}; exit 1; } && ${safeCheckout};`;
        
        k.stdin.end(cmd);
        k.stderr.pipe(pt(chalk.yellow.bold(`[publishing ${name}]: `))).pipe(process.stderr);
        
        k.once('exit', code => {
          
          if (code > 0) {
            
            log.error('Could not merge release branch into master branch for path:', pth);
            log.error('Please inspect your git repo at path:', pth);
            
            return cb({
              code,
              message: 'Could not run command at path: ' + pth,
              cmd,
              path: pth,
              packageName: name
            });
          }
          
          console.log();
          log.info(chalk.green('The following package was published:'), chalk.greenBright.bold(name));
          console.log();
          cb(null, 'foo');
          
        });
      };
      
      async.mapLimit(modifyReleaseBranches, 1, (v, cb) => {
        
        console.log();
        const releaseName = v.releaseBranchName;
        const tempBranch = v.tempFeatureBranch;
        const fullMasterBranch = v.masterBranch.branchName;
        const k = cp.spawn('bash');
        
        const cmd = [
          `cd ${v.path}`,
          `git fetch origin`,
          `npp_check_merge "${releaseName}" "${fullMasterBranch}"`,
        ]
          .join(' && ');
        
        const result = {
          checkMerge: ''
        };
        
        k.stdin.end(cmd);
        k.stderr.pipe(pt(chalk.yellow.bold(`[publishing ${v.name}]: `))).pipe(process.stderr);
        
        k.stdout.pipe(stdio.createParser()).once(stdio.stdEventName, v => {
          result.checkMerge = v;
        });
        
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
          
          let merged = false;
          
          try {
            merged = JSON.parse(result.checkMerge).value === 'merged';
          }
          catch (err) {
            return cb(err);
          }
          
          const runPublish = () => {
            publish(releaseName, tempBranch, v.path, v.name, v.integrationBranch.branchName, cb);
          };
          
          if (merged) {
            return runPublish();
          }
          
          const prompt = rl.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          prompt.question(
            promptColorFn(
              `It appears that the release branch for package "${v.name}" is not merged into master, is everything OK? (y/n) `
            ) + ' ',
            
            answer => {
              
              prompt.close();
              
              if ((String(answer || '').trim().toLowerCase().startsWith('y'))) {
                return runPublish();
              }
              
              log.info(chalk.yellow('You need to use a phrase that starts with y/Y to contine on.'));
              log.info(chalk.yellow('Too bad things didnt work out, better luck next time.'));
              process.exit(1);
              
            });
          
        });
        
      }, cb);
      
    },
    
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



