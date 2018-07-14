

const semver = require('semver');


const v1 = '0.0.0';
const v2 = '0.0.1';

console.log(semver.lt(v1, v2));
console.log(semver.gt(v2, v1));
