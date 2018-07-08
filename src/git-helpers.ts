'use strict';

import * as cp from 'child_process';
import {EVCallback} from "./find-projects";
import log from './logger';

////////////////////////////////////////////////////////////////

export const getStatus = function (dir: string, remote: string, cb: EVCallback) {

  const k = cp.spawn('bash', [], {
    cwd: dir
  });

  const result = {
    exitCode: null as number,
    upToDateWithRemote: false,
    workingDirectoryClean: false
  };


  let stdout = '';

  k.stderr.setEncoding('utf8');
  k.stderr.pipe(process.stderr);

  k.stdout.on('data', d => {
    stdout += String(d || '').trim();
  });

  k.stdin.end(`git status;`);

  k.once('exit', code => {

    if(code > 0){
      log.error('Could not run "git status" at path:', dir);
    }

     result.exitCode = code;

     if(stdout.match(/Your branch is up-to-date with/i)){
       result.upToDateWithRemote = true;
     }

    if(stdout.match(/nothing to commit, working directory clean/i)){
      result.workingDirectoryClean = true;
    }

    cb(code, result);


  });

};

export const getCurrentBranchName = function (dir: string, remote: string, cb: EVCallback) {

  const k = cp.spawn('bash', [], {
    cwd: dir
  });

  k.stdin.end(`git rev-parse --abbrev-ref HEAD;`);

  const result = {
    exitCode: null as number,
    branchName: ''
  };

  k.stderr.setEncoding('utf8');
  k.stderr.pipe(process.stderr);

  k.stdout.on('data', d => {
    result.branchName = result.branchName += String(d || '').trim();
  });

  k.once('exit', code => {
    result.exitCode = code;
    cb(code, result);
  })

};
