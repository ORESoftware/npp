'use strict';

import path = require("path");
import fs = require('fs');
import async = require('async');
import log from "./logger";
import * as util from "util";
import chalk from "chalk";
import * as git from "./vcs-helpers/git-helpers";
import * as npmh from "./npm-helpers";
import {EVCb, NppJSONConf} from "./index";
import * as nppUtils from "./utils";
import {mapPaths} from "./map-paths";
import * as assert from 'assert';
import {AllLocalBranches} from './vcs-helpers/git-helpers';

export interface Packages {
  [key: string]: boolean | string
}

export enum GitStatus {
  NOT_A_GIT_REPO = '(not a git repo)',
  CLEAN = '(clean - nothing to commit)',
  HAS_CHANGES = '(git repo has uncommitted changes)'
}

export interface BranchInfo {
  packageName: string, // the package.json packageName (might differ across different git branches)
  packageJSON: any,
  nppJSON: any,
  shasumMatch: boolean,
  localVersion: string,
  branchName: string,
  workingDirectoryClean: boolean,
  upToDateWithRemote: boolean,
}

export interface SearchResult {
  pathString: string,
  gitStashString: string,
  allLocalBranchesString: string,
  currentBranch: BranchInfo,
  masterBranch: Partial<BranchInfo>,
  currentBranchString: string,
  integrationBranch: BranchInfo,
  integrationBranchString: string,
  npmRegistryVersion: string,
  name: string,
  path: string,
  tempFeatureBranch?: string,
  releaseBranchName?: string
}

export interface SearchResultMap {
  [key: string]: SearchResult
}

process.stdout.setMaxListeners(30);
process.stderr.setMaxListeners(30);

//////////////////////////////////////////////////////////////////////////

export type Task = (cb: EVCb<any>) => void;
const q = async.queue<Task, any>((task, cb) => task(cb), 3);

export const getFSMap = function (searchRoots: Array<string>, opts: any, packages: Packages, cb: EVCb<any>) {
  
  const map: SearchResultMap = {};
  
  const alreadySearched: { [key: string]: true } = {};
  
  const isBasicSearchable = function (p: string) {
    return !alreadySearched[p];
  };
  
  const isSearchable = function (p: string) {
    
    if (alreadySearched[p]) {
      return false;
    }
    
    const keys = Object.keys(alreadySearched);
    
    if (keys.length < 1) {
      return true;
    }
    
    return !keys.some(v => {
      return p.startsWith(v + '/');
    });
    
  };
  
  const status = {
    searching: true,
    first: true
  };
  
  q.error = q.drain = function (err?: any) {
    
    if (err) {
      status.searching = false;
      log.error(chalk.magenta('There was a search queue processing error.'));
    }
    
    if (status.first) {
      q.kill();
      cb(err, map);
    }
    
    status.first = false;
  };
  
  const searchDir = function (dir: string, cb: any) {
    
    log.debug('Searching dir:', dir);
    
    if (!isBasicSearchable(dir)) {
      return process.nextTick(cb);
    }
    
    if (status.searching === false) {
      return process.nextTick(cb);
    }
    
    alreadySearched[dir] = true;
    
    fs.readdir(dir, function (err, items) {
      
      if (status.searching === false) {
        return cb(null);
      }
      
      if (err) {
        log.warn(err.message || err);
        if (String(err.message || err).match(/permission denied/)) {
          return cb(null);
        }
        return cb(err);
      }
      
      const mappy = function (item: string, cb: Function) {
        
        item = path.resolve(dir + '/' + item);
        
        fs.lstat(item, function (err, stats) {
          
          if (status.searching === false) {
            return cb(null);
          }
          
          if (err) {
            log.warn(err.message);
            return cb(null);
          }
          
          if (stats.isSymbolicLink()) {
            opts.verbosity > 2 && log.warn('looks like a symbolic link:', item);
            return cb(null);
          }
          
          if (stats.isDirectory()) {
            
            if (!isBasicSearchable(item)) {
              return cb(null);
            }
            
            if (item.endsWith('/.idea') || item.endsWith('/.idea/')) {
              return cb(null);
            }
            
            if (item.endsWith('/.git') || item.endsWith('/.git/')) {
              return cb(null);
            }
            
            if (item.endsWith('/.npm') || item.endsWith('/.npm/')) {
              return cb(null);
            }
            
            if (item.endsWith('/.cache') || item.endsWith('/.cache/')) {
              return cb(null);
            }
            
            if (item.endsWith('/node_modules') || item.endsWith('/node_modules/')) {
              return cb(null);
            }
            
            if (item.endsWith('/.nvm') || item.endsWith('/.nvm/')) {
              return cb(null);
            }
            
            return searchDir(item, cb);
          }
          
          if (!stats.isFile()) {
            log.warn('unexpected non-file here:', item);
            return cb(null);
          }
          
          if (!item.endsWith('/package.json')) {
            return cb(null);
          }
          
          async.autoInject({
            
            readPackageJSON(cb: EVCb<any>) {
              fs.readFile(item, cb);
            }
            
          }, (err, results) => {
            
            if (status.searching === false) {
              return cb(null);
            }
            
            if (err) {
              return cb(err);
            }
            
            let parsedPkgJSON: any = null;
            
            try {
              parsedPkgJSON = JSON.parse(String(results.readPackageJSON));
            }
            catch (err) {
              log.error('trouble parsing package.json file at path => ', chalk.magenta(item));
              log.error(err.message || err);
              return cb(err);
            }
            
            let name = parsedPkgJSON.name;
            
            if (!packages[name]) {
              log.debug('The following packageName was not in the packages map from .npp.json:', name);
              return cb(null);
            }
            
            let npp: NppJSONConf = null;
            const nppPath = path.resolve(dir + '/.npp.json');
            
            try {
              npp = require(nppPath);
            }
            catch (err) {
              log.warn('no .npp.json file in this dir => ', chalk.magenta(dir));
            }
            
            let version = parsedPkgJSON.version;
            let publishable = parsedPkgJSON.npp && parsedPkgJSON.npp.publishable === true;
            // let notPublishable = parsed.npp && parsed.npp.publishable === false;
            
            if (npp === null && publishable !== true) {
              log.warn('Skipping the following package packageName:', name, 'at path:', dir);
              log.warn('This package was skipped because it either did not have an .npp.json file, or npp.publishable in package.json was not set to true');
              log.warn('Here is npp in package.json:', parsedPkgJSON.npp);
              log.warn('Here is publishable:', publishable);
              return cb(null);
            }
            
            if (map[name] && (npp || publishable)) {
              
              log.warn('the following package may exist in more than one place on your fs =>', chalk.magenta(name));
              log.warn('pre-existing place => ', map[name]);
              log.warn('new place => ', chalk.blueBright(item));
              
              return cb(
                new Error('The following requested package packageName exists in more than 1 location on disk, and docker.r2g does not know which one to use ... ' +
                  chalk.magentaBright.bold(util.inspect({name: name, locations: [map[name], item]})))
              )
            }
            
            if (!(parsedPkgJSON && parsedPkgJSON.name && parsedPkgJSON.version)) {
              return cb(new Error('Project at the following path is missing either "packageName" or "version" in package.json => ' + item));
            }
            
            if (npp && npp.searchRoots) {
              
              const filtered = nppUtils.flattenDeep([npp.searchRoots, npp.searchRoot]).map(v => String(v || '').trim()).filter(Boolean);
              mapPaths(filtered, dir, (err, results) => {
                
                results.forEach(v => {
                  if (isSearchable(v)) {
                    log.info('adding this to the search queue:', v);
                    q.push(function (cb: EVCb<any>) {
                      log.info('Now searching path:', v);
                      searchDir(v, cb);
                    });
                  }
                });
                
              });
            }
            
            async.autoInject({
                
                getLatestVersionFromNPMRegistry(cb: EVCb<npmh.RegistryData>) {
                  
                  if (!opts.isPublish && !opts.view_npm_registry) {
                    return process.nextTick(cb, null, <npmh.RegistryData> {
                      exitCode: null,
                      npmVersion: ''
                    });
                  }
                  
                  npmh.getLatestVersionFromNPMRegistry(dir, name, cb);
                },
                
                getRepoDir(cb: EVCb<string>) {
                  git.getGitRepoPath(dir, '<remote>', (err, v) => {
                    if (!err && !(v.path && typeof v.path === 'string')) {
                      log.error(err, v);
                      err = 'Could not find corresponding git repo for dir: ' + chalk.magenta.bold(dir);
                    }
                    cb(err, v && v.path);
                  });
                },
                
                checkGitStatus(getRepoDir: string, getLocalDistDataCurrentBranch: any, cb: EVCb<git.GitStatusData>) {
                  git.getStatusOfCurrentBranch(getRepoDir, '<remote>', cb);
                },
                
                getBranchName(getRepoDir: string, cb: EVCb<git.BranchNameData>) {
                  git.getCurrentBranchName(getRepoDir, '<remote>', cb);
                },
                
                getStatusOfIntegrationBranch(
                  getRepoDir: string,
                  checkGitStatus: any,
                  getLocalDistDataCurrentBranch: any,
                  readPackageJsonAndNPP: nppUtils.JSONData,
                  cb: EVCb<git.GitStatusData>) {
                  
                  // note we need to check the status of the current branch before checking out the integration branch
                  const ib = readPackageJsonAndNPP.nppJSON.vcsInfo.integration;
                  git.getStatusOfIntegrationBranch(getRepoDir, '<remote>', ib, cb);
                },
                
                getRegistryDistData(cb: EVCb<npmh.DistDataResult>) {
                  npmh.getDistDataFromNPMRegistry(dir, name, cb);
                },
                
                getLocalDistDataCurrentBranch(cb: EVCb<nppUtils.LocalDistDataResult>) {
                  nppUtils.getLocalTarballDistData(dir, name, cb);
                },
                
                getLocalDistDataIntegrationBranch(getStatusOfIntegrationBranch: any, cb: EVCb<nppUtils.LocalDistDataResult>) {
                  nppUtils.getLocalTarballDistData(dir, name, cb);
                },
                
                getNPMTarballData(cb: EVCb<npmh.NPMRegistryShasums>) {
                  npmh.getNPMTarballData(dir, name, cb)
                },
                
                deleteLocalBranches(checkMergedForAllLocalBranches: AllLocalBranches, cb: EVCb<git.DeletedLocalBranches>) {
                  
                  if(!opts.delete){
                    return process.nextTick(cb, null, []);
                  }
                  
                  git.deleteLocalBranches(dir, checkMergedForAllLocalBranches, '<remote>', cb);
                },
                
                readPackageJsonAndNPP(cb: EVCb<nppUtils.JSONData>) {
                  nppUtils.readPackageJSONandNPP(dir, (err, val) => {
                    
                    if (err) {
                      return cb(err);
                    }
                    
                    try {
                      assert.strictEqual(typeof val.nppJSON.vcsInfo.master, 'string');
                      assert.strictEqual(typeof val.nppJSON.vcsInfo.integration, 'string');
                    }
                    catch (err) {
                      return cb(err);
                    }
                    
                    cb(null, val);
                    
                  });
                },
                
                checkMergedForAllLocalBranches(getRepoDir: string, readPackageJsonAndNPP: nppUtils.JSONData, cb: EVCb<git.AllLocalBranches>) {
                  const ib = readPackageJsonAndNPP.nppJSON.vcsInfo.integration;
                  git.allLocalBranches(getRepoDir, name, ib, cb);
                },
                
                showGitStash(getRepoDir: string, cb: EVCb<git.GitStashShow>) {
                  git.getStash(getRepoDir, name, cb);
                }
              },
              
              (err: any, results) => {
                
                if (err) {
                  log.error(chalk.magenta(err.message || err));
                  process.exit(1);
                }
                
                if (status.searching === false) {
                  return cb(null);
                }
                
                const localDistDataIntegrationBranch = results.getLocalDistDataIntegrationBranch as nppUtils.LocalDistDataResult;
                const localDistDataCurrentBranch = results.getLocalDistDataCurrentBranch as nppUtils.LocalDistDataResult;
                const npmDistData = results.getRegistryDistData as npmh.DistDataResult;
                const npmShasums = results.getNPMTarballData as npmh.NPMRegistryShasums;
                const integrationBranchJSON = results.readPackageJsonAndNPP as nppUtils.JSONData;
                const allLocalBranches = results.checkMergedForAllLocalBranches as git.AllLocalBranches;
                let gitStash = (results.showGitStash as git.GitStashShow).gitStash || '(no stdout/stderr)';
                
                if (gitStash.length > 250) {
                  gitStash = gitStash.slice(0, 300) + '...(truncated).';
                }
                
                // log.debug('local dist data:', localDistDataCurrentBranch);
                // log.debug('npm dist data:', npmDistData);
                // log.debug('npm shasums:', npmShasums);
                
                let integrationBranchVersion = null;
                let integrationBranchPackageName = null;
                
                try {
                  integrationBranchVersion = integrationBranchJSON.packageJSON.version;
                  assert.strictEqual(typeof integrationBranchVersion, 'string');
                  integrationBranchPackageName = integrationBranchJSON.packageJSON.name;
                  assert.strictEqual(typeof integrationBranchPackageName, 'string');
                }
                catch (err) {
                  return cb(err);
                }
                
                let shasumMatchCurrentBranch = false;
                let shasumMatchIntegrationBranch = false;
                
                try {
                  shasumMatchCurrentBranch = localDistDataCurrentBranch.shasums.includes(npmDistData.distData.shasum) ||
                    localDistDataCurrentBranch.shasums.some(v => npmShasums.shasums.includes(v));
                  
                  shasumMatchIntegrationBranch = localDistDataIntegrationBranch.shasums.includes(npmDistData.distData.shasum) ||
                    localDistDataIntegrationBranch.shasums.some(v => npmShasums.shasums.includes(v));
                }
                catch (err) {
                  log.warn(err.message);
                }
                
                log.info('added the following package packageName to the map:', name);
                
                const currentBranchName = results.getBranchName.branchName;
                const currentBranchClean = results.checkGitStatus.workingDirectoryClean;
                const currentBranchUpToDate = results.checkGitStatus.upToDateWithRemote;
                const integrationBranchClean = results.getStatusOfIntegrationBranch.workingDirectoryClean;
                const integrationBranchUpToDate = results.getStatusOfIntegrationBranch.upToDateWithRemote;
                const ib = results.readPackageJsonAndNPP.nppJSON.vcsInfo.integration;
                
                map[name] = {
                  name,
                  path: dir,
                  pathString: nppUtils.wrapString(30, dir),
                  npmRegistryVersion: results.getLatestVersionFromNPMRegistry.npmVersion,
                  
                  allLocalBranchesString: allLocalBranches.results.map(v => {
                    return `${v.branch} => ${v.value === 'merged' ? chalk.green('merged') : chalk.yellow(v.value)}`;
                  }).join('\n'),
                  
                  gitStashString: nppUtils.wrapString(40, gitStash),
                  
                  currentBranchString: [
                    currentBranchName,
                    version,
                    shasumMatchCurrentBranch ? chalk.magenta('(shasum matched)') : '(shasum not matched)',
                    currentBranchClean ? '(clean status)' : chalk.red('(unclean status)'),
                    currentBranchUpToDate ? '(up-to-date)' : chalk.red('(not up-to-date with remote)')
                  ].join(',\n'),
                  
                  currentBranch: {
                    packageName: name,
                    packageJSON: parsedPkgJSON,
                    nppJSON: npp || null,
                    shasumMatch: shasumMatchCurrentBranch,
                    localVersion: version,
                    branchName: currentBranchName,
                    workingDirectoryClean: currentBranchClean,
                    upToDateWithRemote: currentBranchUpToDate,
                  },
                  
                  integrationBranchString: [
                    ib,
                    integrationBranchVersion,
                    shasumMatchIntegrationBranch ? chalk.magenta('(shasum matched)') : '(shasum not matched)',
                    integrationBranchClean ? '(clean status)' : chalk.red('(unclean status)'),
                    integrationBranchUpToDate ? '(up-to-date)' : chalk.red('(not up-to-date with remote)')
                  ].join(',\n'),
                  
                  masterBranch: {
                    branchName: integrationBranchJSON.nppJSON.vcsInfo.master,
                  },
                  
                  integrationBranch: {
                    packageName: integrationBranchPackageName,
                    packageJSON: integrationBranchJSON.packageJSON,
                    nppJSON: integrationBranchJSON.nppJSON,
                    shasumMatch: shasumMatchIntegrationBranch,
                    localVersion: integrationBranchVersion,
                    branchName: ib,
                    workingDirectoryClean: integrationBranchClean,
                    upToDateWithRemote: integrationBranchUpToDate,
                  },
                };
                
                cb(null);
                
              });
            
          });
          
        });
        
      };
      
      async.eachLimit(
        items,
        4,
        mappy,
        cb
      );
      
    });
    
  };
  
  searchRoots.forEach(v => {
    log.info('Adding the following path to the search queue:', chalk.gray.bold(v));
    q.push(function (cb: EVCb<any>) {
      log.info('Now searching path:', chalk.gray.bold(v));
      searchDir(v, cb);
    });
  });
  
  if (q.idle()) {
    return process.nextTick(cb, new Error('For some reason, no paths/items went onto the search queue.'));
  }
  
};
