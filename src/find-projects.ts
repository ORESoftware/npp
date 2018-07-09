'use strict';

import path = require("path");
import fs = require('fs');
import async = require('async');
import log from "./logger";
import * as util from "util";
import chalk from "chalk";
import {getCurrentBranchName, getStatus} from "./git-helpers";

export interface Packages {
  [key: string]: boolean | string
}

export enum GitStatus {
  NOT_A_GIT_REPO = '(not a git repo)',
  CLEAN = '(clean - nothing to commit)',
  HAS_CHANGES = '(git repo has uncommitted changes)'
}

export interface SearchResult {
  branch: string,
  version: string,
  name: string,
  path: string,
  upToDateWithRemote: boolean,
  workingDirectoryClean: boolean
}

export interface Map {
  [key: string]: SearchResult
}

export type EVCallbackResult = (err: any, v?: Map) => void;
export type EVCallback = (err: any, v?: any) => void;

//////////////////////////////////////////////////////////////////////////

const q = async.queue((task, cb) => task(cb), 3);

export const getFSMap = function (searchRoots: Array<string>, opts: any, packages: Packages, cb: EVCallbackResult) {

  const map: Map = {};

  const alreadySearched: { [key: string]: true } = {};

  const isSearchable = function (p: string) {

    if (alreadySearched[p]) {
      return false;
    }

    const keys = Object.keys(alreadySearched);

    if(keys.length < 1){
      return true;
    }

    return !keys.some(v => {
      return v.startsWith(p + '/');
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

    if (!isSearchable(dir)) {
      return process.nextTick(cb);
    }

    if(status.searching === false){
      return process.nextTick(cb);
    }

    alreadySearched[dir] = true;

    fs.readdir(dir, function (err, items) {

      if(status.searching === false){
        return cb(null);
      }

      if (err) {
        if (String(err.message || err).match(/permission denied/)) {
          log.warn(err.message || err);
          return cb(null);
        }
        return cb(err);
      }

      const mappy = function (item: string, cb: Function) {

        item = path.resolve(dir + '/' + item);

        fs.lstat(item, function (err, stats) {

          if(status.searching === false){
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

            if (!isSearchable(item)) {
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

            readPackageJSON(cb: EVCallback) {
              fs.readFile(item, cb);
            }

          }, (err, results) => {

            if(status.searching === false){
              return cb(null);
            }

            if (err) {
              return cb(err);
            }

            let parsed = null;

            try {
              parsed = JSON.parse(String(results.readPackageJSON));
            }
            catch (err) {
              log.error('trouble parsing package.json file at path => ', item);
              log.error(err.message || err);
              return cb(err);
            }

            let name = parsed.name;

            if (!packages[name]) {
              return cb(null);
            }

            let npp = null;
            const nppPath = path.resolve(dir + '/.npp.json');

            try {
              npp = require(nppPath);
            }
            catch (err) {
              log.warn('no .npp.json file at path => ', item);
            }

            let version = parsed.version;
            let publishable = parsed.npp && parsed.npp.publishable === true;
            // let notPublishable = parsed.npp && parsed.npp.publishable === false;

            if (npp === null && publishable !== true) {
              log.warn('Skipping the following package name:', name, 'at path:', dir);
              log.warn('This package was skipped because it either did not have an .npp.json file, or npp.publishable in package.json was not set to true');
              log.warn('Here is npp in package.json:', parsed.npp);
              log.warn('Here is publishable:', publishable);
              return cb(null);
            }

            if (map[name] && (npp || publishable)) {

              log.warn('the following package may exist in more than one place on your fs =>', chalk.magenta(name));
              log.warn('pre-existing place => ', map[name]);
              log.warn('new place => ', chalk.blueBright(item));

              return cb(
                new Error('The following requested package name exists in more than 1 location on disk, and docker.r2g does not know which one to use ... ' +
                  chalk.magentaBright.bold(util.inspect({name: name, locations: [map[name], item]})))
              )
            }

            if (!(parsed && parsed.name && parsed.version)) {
              return cb(new Error('Project at the following path is missing either "name" or "version" in package.json => ' + item));
            }

            if (npp && npp.searchRoots) {
              try {
                npp.searchRoots.forEach(v => {
                  if(isSearchable(v)){
                    log.info('adding this to the search queue:', v);
                    q.push(function (cb: EVCallback) {
                      log.info('Now searching path:', v);
                      searchDir(v, cb);
                    });
                  }
                });
              }
              catch (err) {
                log.error(err);
                return cb(new Error('npp.searchRoots was problematic (probably not an array), at path: ' + chalk.magenta(nppPath)));
              }
            }

            async.autoInject({

                checkGitStatus(cb: EVCallback) {
                  getStatus(dir, '<remote>', cb);
                },

                getBranchName(checkGitStatus: any, cb: EVCallback) {
                  getCurrentBranchName(dir, '<remote>', cb);
                }

              },

              (err, results) => {

                log.info('added the following package name to the map:', name);
                map[name] = {
                  name,
                  version,
                  branch: results.getBranchName.branchName,
                  upToDateWithRemote: results.checkGitStatus.upToDateWithRemote,
                  workingDirectoryClean: results.checkGitStatus.workingDirectoryClean,
                  path: dir,

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
    log.info('Adding the following path to the search queue:', v);
    q.push(function (cb: EVCallback) {
      log.info('Now searching path:', v);
      searchDir(v, cb);
    });
  });

  if (q.idle()) {
    return process.nextTick(cb, new Error('For some reason, no paths/items went onto the search queue.'));
  }

};
