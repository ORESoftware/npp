'use strict';

import * as cp from 'child_process';
import log from '../logger';
import {EVCb} from "../index";
import chalk from "chalk";
import async = require('async');
import * as stdio from 'json-stdio';
import * as path from 'path';
import pt from 'prepend-transform';

////////////////////////////////////////////////////////////////

export interface GitStatusData {
  exitCode: number,
  upToDateWithRemote: boolean,
  workingDirectoryClean: boolean
}

export type Task = (cb: EVCb<any>) => void;

const queues = new Map<string, async.AsyncQueue<Task>>();

const getQueue = (dir: string): async.AsyncQueue<Task> => {
  if (!queues.has(dir)) {
    queues.set(dir, async.queue<Task, any>((task, cb) => task(cb), 1));
  }
  return queues.get(dir);
};

export const getStatusOfIntegrationBranch = function (dir: string, remote: string, integration: string, cb: EVCb<GitStatusData>) {
  
  getQueue(dir).push(cb => {
    
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
    k.stderr.pipe(pt(`[${dir}]: `)).pipe(process.stderr);
    
    k.stdout.pipe(stdio.createParser()).on(stdio.stdEventName, d => {
      stdout = String(d || '');
      log.debug('stdout for integration branch status:', chalk.blue(stdout));
    });
    
    const tempIntegrationBranch = `npp_tool/integration_temp/${Date.now()}`;
    
    const cmd = [
      `git fetch origin`,
      `( ( git branch --list 'npp_tool/integration_temp/*' | xargs -r git branch -D ) &> /dev/null || echo "" )`,
      // `git branch --no-track ${tempIntegrationBranch} ${integration}`,
      `git branch ${tempIntegrationBranch} ${integration}`,
      `git checkout ${tempIntegrationBranch}`,
      `json_stdio "$(git status -v |  tr '\r\n' ' ')"` // replace newline char with space
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
  
  getQueue(dir).push(cb => {
    
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
    k.stderr.pipe(pt(`[${dir}]: `)).pipe(process.stderr);
    
    k.stdout.on('data', d => {
      stdout += String(d || '').trim();
    });
    
    const cmd = `git status -v |  tr '\r\n' ' '`;  // replace newline chars with space
    
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
  
  getQueue(dir).push(cb => {
    
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
    k.stderr.pipe(pt(`[${dir}]:`)).pipe(process.stderr);
    
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
  
  getQueue(dir).push(cb => {
    
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
    k.stderr.pipe(pt(`[${dir}]: `)).pipe(process.stderr);
    
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

export interface AllLocalBranches {
  exitCode: number,
  results: Array<{ branch: string, value: string }>
}

export const allLocalBranches = function (dir: string, remote: string, cb: EVCb<AllLocalBranches>) {
  
  getQueue(dir).push(cb => {
    
    const k = cp.spawn('bash', [], {
      cwd: dir
    });
    
    const cmd = [
      `set -e`,
      `npp_install_json_stdio`,
      `git fetch origin`,
      `git branch -l | tr -d " *" | while read branch; do`,
      // for each local branch,
      // we check if the last commit is already merged into integration branch
      `npp_check_merge "$branch" "master"`,
      `done`
    ].join('\n');
    
    k.stdin.end(cmd);
    
    const res = <AllLocalBranches>{
      exitCode: null as number,
      results: []
    };
    
    k.stderr.setEncoding('utf8');
    k.stderr.pipe(pt(`[${dir}]: `)).pipe(process.stderr);
    
    k.stdout.pipe(stdio.createParser()).on(stdio.stdEventName, d => {
      res.results.push(d);
    });
    
    k.once('exit', code => {
      
      res.exitCode = code;
      
      if (code > 0) {
        return cb({code, message: `Could not run the following command: ${chalk.bold(cmd)}`}, res);
      }
      
      try {
        res.results = res.results.map(v => JSON.parse(String(v).trim()));
        cb(null, res);
      }
      catch (err) {
        cb(err);
      }
      
    });
    
  }, cb);
  
};

export interface GitStashShow {
  exitCode: number,
  gitStash: string
}

export const getStash = function (dir: string, name: string, cb: EVCb<GitStashShow>) {
  
  getQueue(dir).push(cb => {
    
    const k = cp.spawn('bash', [], {
      cwd: dir
    });
    
    const cmd = `git stash show | cat`;  // always exit with 0
    k.stdin.end(cmd);
    
    const result = <GitStashShow> {
      exitCode: null,
      gitStash: ''
    };
    
    k.stderr.setEncoding('utf8');
    k.stderr.pipe(pt(chalk.yellow(`running git stash show for '${name}': `))).pipe(process.stderr);
    
    k.stdout.on('data', v => {
      result.gitStash += String(v || '');
    });
  
    k.stderr.on('data', v => {
      result.gitStash += String(v || '');
    });
    
    k.once('exit', code => {
      
      result.exitCode = code;
      
      if (code > 0) {
        return cb({code, message: `Could not run the following command: "${chalk.bold(cmd)}".`}, result);
      }
      
      cb(null, result);
      
    });
    
  }, cb);
  
};
