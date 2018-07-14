'use strict';


export type EVCb<T> = (err: any, val?: T) => void;


export const r2gSmokeTest = function () {
  // r2g command line app uses this exported function
  return true;
};


export interface NppJSONConf {
  searchRoots: Array<string>,
  remoteTrackingBranch: string,
  branch: string,
  vcs: string,
  packages: {[key: string]: boolean}
}


/*

 bad library design:
 module.exports = 'foo';
 export = 'foo';

 good library design:
 exports.x = 'foo'
 export const x = 'foo'
 export default = 'foo';

*/



