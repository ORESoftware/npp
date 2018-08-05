'use strict';

import * as cp from 'child_process';
import log from './logger';
import {EVCb} from "./index";
import chalk from "chalk";
import pt from 'prepend-transform';
import * as path from "path";
import * as stdio from 'json-stdio';
import {LocalDistDataResult} from './utils';
import shortid = require('shortid');

////////////////////////////////////////////////////////////////

export interface RegistryData {
  exitCode: number,
  npmVersion: string
}

export const getLatestVersionFromNPMRegistry = function (dir: string, name: string, cb: EVCb<RegistryData>) {
  
  const k = cp.spawn('bash', [], {
    cwd: dir
  });
  
  const cmd = `npm view ${name}@latest version;`;
  k.stdin.end(cmd);
  
  const result = {
    exitCode: null as number,
    npmVersion: ''
  };
  
  k.stderr.setEncoding('utf8');
  k.stderr.pipe(pt(chalk.yellow(`[ ${cmd} ]: `))).pipe(process.stderr);
  
  k.stdout.on('data', d => {
    result.npmVersion = result.npmVersion += String(d || '').trim();
  });
  
  k.once('exit', code => {
    result.exitCode = code;
    
    let err = null;
    if (code > 0) {
      err = {code, message: `Could not run the following command: "${chalk.bold(cmd)}".`}
    }
    
    cb(err, result);
  });
  
};


export interface DistData {
  integrity: string,
  shasum: string,
  tarball: string, // url
  fileCount: number,
  unpackedSize: number,
  'npm-signature': string
}

export interface DistDataResult {
  exitCode: number,
  distData: DistData
}

export const getDistDataFromNPMRegistry = function (dir: string, name: string, cb: EVCb<DistDataResult>) {
  
  const k = cp.spawn('bash', [], {
    cwd: dir
  });
  
  const cmd = `npm view ${name}@latest dist --json`;
  k.stdin.end(cmd);
  
  const result = {
    exitCode: null as number,
    distData: null as DistData
  };
  
  k.stderr.setEncoding('utf8');
  k.stderr.pipe(pt(chalk.yellow(`[ ${cmd} ]: `))).pipe(process.stderr);
  
  let stdout = '';
  
  k.stdout.on('data', d => {
    stdout += String(d || '').trim();
  });
  
  k.once('exit', code => {
    
    result.exitCode = code;
    
    if (code > 0) {
      return cb({code, message: `Could not run the following command: "${chalk.bold(cmd)}".`}, result);
    }
    
    try {
      result.distData = JSON.parse(stdout);
      cb(null, result);
    }
    catch (err) {
      cb(err, result);
    }
    
  });
  
};

export interface NPMRegistryShasums {
  exitCode: number,
  shasums: Array<string>
}

export const getNPMTarballData = function (dir: string, name: string, cb: EVCb<NPMRegistryShasums>) {
  
  const k = cp.spawn('bash', [], {
    cwd: dir
  });
  
  const id = shortid.generate();
  const p = `$HOME/.npp/temp/${id}`;
  const bn = path.basename(dir);
  
  const cmd = [
    `mkdir -p "${p}"`,
    `cd "${p}"`,
    `tgz="$(npm pack --loglevel=warn '${name}@latest')"`,
    `json_stdio "$(sha1sum $tgz)"`,
    `json_stdio "$(tar -xOzf $tgz | sort | sha1sum)"`,
    `rm -rf "${p}"`
  ]
    .join(' && ');
  
  k.stdin.end(cmd);
  
  const result = <NPMRegistryShasums> {
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

export interface GitStashShow {
  exitCode: number,
  gitStash: string
}


export const getStash = function (dir: string, name: string, cb: EVCb<GitStashShow>) {
  
  const k = cp.spawn('bash', [], {
    cwd: dir
  });
  
  const id = shortid.generate();
  const p = `$HOME/.npp/temp/${id}`;
  const bn = path.basename(dir);
  
  const cmd = [
   `git stash show`
  ]
    .join(' ');
  
  k.stdin.end(cmd);
  
  const result = <GitStashShow> {
    exitCode: null as number,
    gitStash: ''
  };
  
  k.stderr.setEncoding('utf8');
  k.stderr.pipe(pt(chalk.yellow(`running git stash show for '${name}': `))).pipe(process.stderr);
  
  k.stdout.on('data', v => {
     result.gitStash += String(v || '');
  });
  
  k.once('exit', code => {
    
    result.exitCode = code;
    
    if (code > 0) {
      return cb({code, message: `Could not run the following command: "${chalk.bold(cmd)}".`}, result);
    }
    
    cb(null, result);
    
  });
  
};
