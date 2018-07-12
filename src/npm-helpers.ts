'use strict';

import * as cp from 'child_process';
import log from './logger';
import {EVCb} from "./index";

////////////////////////////////////////////////////////////////



export const getLatestVersionFromNPMRegistry = function (dir: string, name: string, cb: EVCb<typeof result>) {

  const k = cp.spawn('bash', [], {
    cwd: dir
  });

  k.stdin.end(`npm view ${name}@latest version;`);

  const result  = {
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
    cb(code, result);
  })

};
