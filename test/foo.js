const input = [
  "/home/oleg/WebstormProjects/oresoftware/r2g",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-types",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-watch",
  "/home/oleg/WebstormProjects/oresoftware",
];

const input2 = [
  "/home/oleg/WebstormProjects/oresoftware/r2g",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-types",
  "/home/oleg/WebstormProjects/oresoftware/sumanjs/suman-watch"
];

function getParents(input) {
  return input.reduce((acc, a) => {

    const index = acc.findIndex(b => b.startsWith(a) || a.startsWith(b));

    const slashDiff = index > 0 ? a.split('/').length === acc[index].split('/').length : false;

    if (index === -1 || slashDiff) {
      return [...acc, a];
    }

    acc.splice(index, 1, a.length < acc[index].length ? a : acc[index]);

    return acc;

  }, []);

}

console.log(getParents(input));
console.log(getParents(input2));
