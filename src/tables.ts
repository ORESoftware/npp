import chalk from "chalk";

export const getViewTable = function(opts: any){

  return [
    {
      header: 'Name',
      value: 'name'
    },
    // {
    //   header: 'Has valid .npp.json?',
    //   value: 'validNPPJSON'
    // },
    {
      header: 'Local Version',
      value: 'localVersion'
    },

    {
      header: 'NPM Registry Version',
      value: 'npmRegistryVersion',
      conditionals: ['view_npm_registry']
    },

    {
      header: 'Current Branch',
      value: 'currentBranch'
    },

    {
      header: 'Clean?',
      value: 'workingDirectoryClean'
    },

    {
      header: 'Up-to-Date with remote?',
      value: 'upToDateWithRemote'
    },

    {
      header: 'Path',
      value: 'path',
      conditionals: ['view_packages_path']
    },


  ].filter(v => {

    if(!v.conditionals){
      return true;
    }

    return v.conditionals.some(v => {
      return opts[v] === true;
    });

  })
  .map(v => {

    v.header = chalk.blue(v.header);
    return v;
  });


};



