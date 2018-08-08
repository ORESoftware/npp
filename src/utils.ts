'use strict';

import {EVCb} from './index';
import * as cp from "child_process";
import chalk from 'chalk';
import shortid = require("shortid");
import * as path from 'path';
import * as stdio from 'json-stdio';
import pt from 'prepend-transform';
import {NPMRegistryShasums} from './npm-helpers';
import async = require('async');
import * as fs from 'fs';
import * as assert from "assert";
import log from './logger';

export const flattenDeep = function (a: Array<any>): Array<any> {
  return a.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
};

export interface LocalDistDataResult {
  exitCode: number,
  shasums: Array<string>
}

export const assertString = (str: string) : string => {
  assert.strictEqual(typeof str, 'string');
  const index = str.indexOf('#');
  if(index > 0){
    str = str.slice(0, index);
  }
  return str;
};

export const wrapString = (count: number, str: string) => {
  const letters = [], ln = str.length;
  
  for(let i = 0; i < ln; i++){
    letters.push(str[i]);
    if(i> 0 && i%count === 0){
      letters.push('\n');
    }
  }
  
  return letters.join('');
};

export const getLocalTarballDistData = function (dir: string, name: string, cb: EVCb<LocalDistDataResult>) {
  
  const k = cp.spawn('bash', [], {
    cwd: dir
  });
  
  const id = shortid.generate();
  const p = `$HOME/.npp/temp/${id}`;
  const bn = path.basename(dir);
  
  const cmd = [
    `mkdir -p "${p}"`,
    `rsync -r --exclude=node_modules "${dir}" "${p}"`,
    `cd "${p}/${bn}"`,
    `tgz=$(npm pack --loglevel=warn)`,
    `json_stdio "$(sha1sum $tgz)"`,
    `json_stdio "$(tar -xOzf $tgz | sort | sha1sum)"`,
    `rm -rf "${p}"`
  ]
    .join(' && ');
  
  k.stdin.end(cmd);
  
  const result = <LocalDistDataResult>{
    exitCode: null as number,
    shasums: []
  };
  
  k.stderr.setEncoding('utf8');
  k.stderr.pipe(pt(chalk.yellow(`creating local tarball for package '${name}': `))).pipe(process.stderr);
  
  k.stdout.pipe(stdio.createParser()).on(stdio.stdEventName, v => {
    result.shasums.push(String(v || '').trim().split(/\s+/)[0]);
  });
  
  k.once('exit', code => {
    
    result.exitCode = code;
    
    if (code > 0) {
      return cb({code, message: `Could not run the following command: "${chalk.bold(cmd)}".`}, result);
    }
    
    cb(null, result);
    
  });
  
};

export interface JSONData {
  packageJSON: any,
  nppJSON: any
}

export const readPackageJSONandNPP = function (dir: string, cb: EVCb<JSONData>) {
  
  const result = <JSONData>{
    packageJSON: null,
    nppJSON: null
  };
  
  async.parallel({
    
    packageJSON(cb: EVCb<any>) {
      fs.readFile(path.resolve(dir + '/package.json'), cb);
    },
    
    nppJSON(cb: EVCb<any>) {
      fs.readFile(path.resolve(dir + '/.npp.json'), cb);
    }
    
  }, (err, results) => {
    
    if (err) {
      log.error(err);
      log.error(chalk.redBright('You may not have an .npp.json file in your integration branch.'));
      return cb({err, message: `Could not read package.json or .npp.json file, at dir: "${dir}".`}, result);
    }
    
    try {
      result.packageJSON = JSON.parse(String(results.packageJSON));
      result.nppJSON = JSON.parse(String(results.nppJSON));
      cb(null, result);
    }
    catch (err) {
      cb(err, result);
    }
    
  });
  
};
