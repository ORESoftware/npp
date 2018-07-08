'use strict';

import * as cp from 'child_process';
import log from './logger';

// mapPaths takes an array of paths/strings with env vars, and expands each one

export const mapPaths = (searchRoots: Array<string>, cb: Function) => {

  const mappedRoots = searchRoots.map(function (v) {
    return `echo "${v}"`;
  });

  const k = cp.spawn('bash');

  k.stdin.end(mappedRoots.join(';'));
  const results: Array<string> = [];
  k.stderr.pipe(process.stderr);

  k.stdout.on('data', (d: string) => {
    results.push(d);
  });

  k.once('error',  (e) => {
    log.error(e.stack || e);
    cb(e);
  });

  k.once('exit', code => {

    if(code > 0){
      log.error('Could not map paths.');
      return cb(code);
    }

    const pths = results
    .map(d => String(d || '').trim())
    .filter(Boolean);

    cb(code, pths);

  });
};
