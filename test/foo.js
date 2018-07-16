

mandatory = () => {
  throw new Error('Missing parameter!');
};

foo = (bar = mandatory()) => {
  return bar;
};


console.log(foo(null));

console.log(global.mandatory);
