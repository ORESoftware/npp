'use strict';

import * as cp from 'child_process';
import log from '../logger';
import {EVCb} from "../index";
import chalk from "chalk";
import async = require('async');
import * as stdio from 'json-stdio';
import * as path from 'path';

////////////////////////////////////////////////////////////////

export interface GitStatusData {
  exitCode: number,
  upToDateWithRemote: boolean,
  workingDirectoryClean: boolean
}

export type Task = (cb: EVCb<any>) => void;
const gitQueue = async.queue<Task, any>((task, cb) => task(cb), 1);


export const getStatusOfIntegrationBranch = function (dir: string, remote: string, integration: string, cb: EVCb<GitStatusData>) {
  
  gitQueue.push(cb => {
    
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
    
    k.stdout.pipe(stdio.createParser()).on(stdio.stdEventName, d => {
      stdout = String(d || '');
      log.info('stdout for integration branch status:', chalk.blue(stdout));
    });
    
    
    const tempIntegrationBranch = `npp_tool/integration_temp/${Date.now()}`;
    
    const cmd = [
      `git fetch origin`,
      `( ( git branch --list 'npp_tool/integration_temp/*' | xargs -r git branch -D ) &> /dev/null || echo "" )`,
      // `git branch --no-track ${tempIntegrationBranch} ${integration}`,
      `git branch ${tempIntegrationBranch} ${integration}`,
      `git checkout ${tempIntegrationBranch}`,
      `json_stdio "$(git status -v | tr -d '\n')"`
    ]
      .join(' && ');
    
    k.stdin.end(cmd);
    
    k.once('exit', code => {
      
      if (code > 0) {
        log.error(`Could not run "${cmd}" at path:`, dir);
        return cb({code});
      }
      
      stdout = String(stdout).trim();
      result.exitCode = code;
      
      if (stdout.match(/Your branch is up-to-date with/ig) || stdout.match(/Your branch is up to date with/ig)) {
        log.debug('Branch is up to date with remote:', dir);
        result.upToDateWithRemote = true;
      }
      else {
        log.debug('Branch at path is not up to date:', dir);
        log.debug('Stdout:', chalk.magenta(stdout));
      }
      
      if (stdout.match(/nothing to commit, working directory clean/ig) || stdout.match(/nothing to commit, working tree clean/ig)) {
        log.debug('Working directory clean:', dir);
        result.workingDirectoryClean = true;
      }
      else {
        log.debug('Working directory is not clean:', dir);
        log.debug(`Stdout for ${path.basename(dir)}:`, chalk.magenta(stdout));
      }
      
      let err = null;
      
      if (code > 0) {
        err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
      }
      
      cb(err, result);
      
    });
    
  }, cb);
  
};

export const getStatusOfCurrentBranch = function (dir: string, remote: string, cb: EVCb<GitStatusData>) {
  
  gitQueue.push(cb => {
  
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
  
    k.stderr.on('data', d => {
      stdout += String(d || '').trim();
    });
  
    const cmd = `git status -v | tr -d '\n'`;
  
    k.stdin.end(cmd);
  
    k.once('exit', code => {
    
      if (code > 0) {
        log.error(`Could not run "${cmd}" at path:`, dir);
        return cb({code});
      }
    
      stdout = String(stdout).trim();
    
      result.exitCode = code;
    
      if (stdout.match(/Your branch is up-to-date with/ig) || stdout.match(/Your branch is up to date with/ig)) {
        log.debug('Branch is up to date with remote:', dir);
        result.upToDateWithRemote = true;
      }
      else {
        log.debug('Branch at path is not up to date:', dir);
        log.debug('Stdout:', stdout);
      }
    
      if (stdout.match(/nothing to commit, working directory clean/ig) || stdout.match(/nothing to commit, working tree clean/ig)) {
        log.debug('Working directory clean:', dir);
        result.workingDirectoryClean = true;
      }
      else {
        log.debug('Working directory is not clean:', dir);
        log.debug('Stdout:', stdout);
      }
    
      let err = null;
    
      if (code > 0) {
        err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
      }
    
      cb(err, result);
    
    });
    
  }, cb);
  
};

export interface BranchNameData {
  exitCode: number,
  branchName: string
}

export const getCurrentBranchName = function (dir: string, remote: string, cb: EVCb<BranchNameData>) {
  
  gitQueue.push(cb => {
  
    const k = cp.spawn('bash', [], {
      cwd: dir
    });
  
    const cmd = `git rev-parse --abbrev-ref HEAD`;
    k.stdin.end(cmd);
  
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
    
      let err = null;
    
      if (code > 0) {
        err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
      }
    
      cb(err, result);
    });
    
  }, cb);

  
};

export interface GitRemoteData {
  exitCode: number,
  gitRemoteURL: string
}

export const getRemoteURL = function (dir: string, remote: string, cb: EVCb<GitRemoteData>) {
  
  gitQueue.push(cb => {
  
    const k = cp.spawn('bash', [], {
      cwd: dir
    });
  
    const cmd = `git remote get-url origin`;
    k.stdin.end(cmd);
  
    const result = {
      exitCode: null as number,
      gitRemoteURL: ''
    };
  
    k.stderr.setEncoding('utf8');
    k.stderr.pipe(process.stderr);
  
    k.stdout.on('data', d => {
      result.gitRemoteURL = result.gitRemoteURL += String(d || '').trim();
    });
  
    k.once('exit', code => {
    
      result.exitCode = code;
    
      let err = null;
    
      if (code > 0) {
        err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
      }
    
      cb(err, result);
    
    });
    
  }, cb);
  

  
};
