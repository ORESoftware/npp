'use strict';


export type EVCb<T> = (err: any, val?: T) => void;


export const r2gSmokeTest = function () {
  return true;
};


export interface NppJSONConf {
  vcsType: 'svn' | 'git' | 'hg',
  vcsInfo: {
    remote: string,
    master: string,
    integration: string
  },
  searchRoot: string,
  searchRoots?: Array<string>,
  packages?: {[key: string]: boolean}
}


export interface NppJSONRootConf {
  searchRoot: string,
  searchRoots: Array<string>
  packages: {[key:string]: any}
}

