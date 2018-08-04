'use strict';

import * as cp from 'child_process';
import log from '../logger';
import {EVCb} from "../index";
import chalk from "chalk";

////////////////////////////////////////////////////////////////

export interface GitStatusData {
  exitCode: number,
  upToDateWithRemote: boolean,
  workingDirectoryClean: boolean
}

export const getStatus = function (dir: string, remote: string, cb: EVCb<GitStatusData>) {

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

  const cmd = `git status -v`;

  k.stdin.end(cmd);

  k.once('exit', code => {

    if (code > 0) {
      log.error(`Could not run "${cmd}" at path:`, dir);
    }

    stdout = String(stdout).trim();

    result.exitCode = code;

    if (stdout.match(/Your branch is up-to-date with/i)) {
      log.debug('Branch is up to date with remote:', dir);
      result.upToDateWithRemote = true;
    }
    else{
      log.debug('Branch at path is not up to date:', dir);
      log.debug('Stdout:', stdout);
    }

    if (stdout.match(/nothing to commit, working directory clean/i)) {
      log.debug('Working directory clean:', dir);
      result.workingDirectoryClean = true;
    }
    else{
      log.debug('Working directory is not clean:', dir);
      log.debug('Stdout:', stdout);
    }

    let err = null;

    if(code > 0){
      err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
    }

    cb(err, result);

  });

};

export interface BranchNameData {
  exitCode: number,
  branchName: string
}

export const getCurrentBranchName = function (dir: string, remote: string, cb: EVCb<BranchNameData>) {

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

    if(code > 0){
      err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
    }

    cb(err, result);
  })

};

export interface GitRemoteData {
  exitCode: number,
  gitRemoteURL: string
}


export const getRemoteURL = function (dir: string, remote: string, cb: EVCb<GitRemoteData>) {

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

    if(code > 0){
      err = {code, message: `Could not run the following command: ${chalk.bold(cmd)}`};
    }

    cb(err, result);

  });

};
