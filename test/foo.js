

// mandatory = () => {
//   throw new Error('Missing parameter!');
// };
//
// foo = (bar = mandatory()) => {
//   return bar;
// };
//
//
// console.log(foo(null));
//
// console.log(global.mandatory);


// const chalk = require('chalk');
// const util = require('util');
// console.log(util.inspect({message: `Here is the highlighted message ${chalk.bold('foo bar baz')}`}));


// let url = 'git+https://github.com/ORESoftware/npp.gitfoo';

let url = 'https://github.com/ORESoftware/npp-foo2/issues';
// console.log(url = url.replace(/.*(?=http)/,''));
//
// console.log(url = url.replace(/.*(?=http)/,''));


console.log(url.slice(0,url.indexOf('/issues')));
