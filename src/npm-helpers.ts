'use strict';

import * as cp from 'child_process';
import log from './logger';
import {EVCb} from "./index";
import chalk from "chalk";
import pt from 'prepend-transform';

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
