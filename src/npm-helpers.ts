'use strict';

import * as cp from 'child_process';
import log from './logger';
import {EVCb} from "./index";
import chalk from "chalk";

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
  k.stderr.pipe(process.stderr);

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
