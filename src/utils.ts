'use strict';

import {EVCb} from './index';
import * as cp from "child_process";
import chalk from 'chalk';
import shortid = require("shortid");
import * as path from 'path';
import * as stdio from 'json-stdio';
import pt from 'prepend-transform';
import {NPMRegistryShasums} from './npm-helpers';

export const flattenDeep = function (a: Array<any>): Array<any> {
  return a.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
};

export interface LocalDistDataResult {
  exitCode: number,
  shasums: Array<string>
}

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
