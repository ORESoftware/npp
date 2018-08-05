

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


const f = {
  z: {
    bar: true
  }
};


console.log(f['z']['bar']);
