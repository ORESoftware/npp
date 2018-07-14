'use strict';


export type EVCb<T> = (err: any, val?: T) => void;


export const r2gSmokeTest = function () {
  return true;
};


export interface VCSType {
  type: 'git' | 'svn' | 'hg',
  value: {
    master: string
    integration: string  | null
  }
}

export interface NppJSONConf {
  searchRoots: Array<string>,
  vcs: VCSType,
  packages: {[key: string]: boolean}
}



