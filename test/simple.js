#!/usr/bin/env node

const input = [
  "/home/oleg/WebstormProjects/oresoftware/r2g",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman",
  "/home/oleg/WebstormProjects/oresoftware",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-types",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-watch"
];

const output = [
  "/home/oleg/WebstormProjects/oresoftware/r2g",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs",
];

const path = require('path');

const getReducedList = function (input) {

  return input
  .sort((a, b) => (a.length - b.length))
  .reduce((a, b) => {

    // console.log('a:', a, 'b:', b);

    const s = !a.some(v => {
      return b.startsWith(v + '/');
    });

    if (s) {
      a.push(b);
    }

    return a;

  }, []);

};

// const getReducedList = function(input) {
//   return input
//   .sort()
//   .reduce((a, b) => {
//     if (b.startsWith(a[a.length - 1] + '/')) {
//       a.pop();
//     }
//     a.push(b);
//     return a;
//   }, []);
// };

// const getReducedList = function(input) {
//   return input
//   .sort()
//   .reduce((a, b) => {
//     if (b.startsWith(a[a.length - 1] + '/')) {
//       a.pop();
//     }
//     a.push(b);
//     return a;
//   }, []);
// };

// const getReducedList = input => [...input].sort().reduce(
//   (a, b) => b.substr(0, b.lastIndexOf("/")) != a[a.length-1] ? [...a,b] : a, []
// );

// const input = [
//   "/home/oleg/WebstormProjects/oresoftware/r2g",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-types",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-watch"
// ];

// const output = getReducedList(input);
//
// console.log(output);

console.log(getReducedList(input));

