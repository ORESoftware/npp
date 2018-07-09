// const input = [
//   "/home/oleg/WebstormProjects/oresoftware",
//   "/home/oleg/WebstormProjects/oresoftware/r2g",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-types",
//   "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-watch"
// ];
//
// input.sort((a,b) => b.length - a.length);
//
// function getPrefixes(list, res =[]) {
//   if (list.length < 1) {
//     return res;
//   }
//   let next = list.pop();
//   res.push(next);
//   return getPrefixes(list.filter(u => !u.startsWith(next + '/')), res)
//
// }
//
// console.log(getPrefixes(input));



// I think you can do this with a very simple recursive function. You simply sort by length, then recursively pop the shortest, add it to the results, filter the array with that, recurse:

const input = [
  "/home/oleg/WebstormProjects/oresoftware/r2g",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman",
  "/home/oleg/WebstormProjects/oresoftware",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-types",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-watch"
];

input.sort((a,b) => b.length - a.length);

function getPrefixes(list, res =[]) {
  if (list.length < 1) return res;
  let next = list.pop();
  res.push(next);
  return getPrefixes(list.filter(u => !u.startsWith(next + '/')), res);

}
console.log(getPrefixes(input));
