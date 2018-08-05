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
 
    // {
    //   header: 'Local Version',
    //   value: 'localVersion'
    // },

    {
      header: 'NPM Registry Version',
      value: 'npmRegistryVersion',
      conditionals: ['view_npm_registry', 'view_all']
    },
  
    // {
    //   header: 'Shasum Match?',
    //   value: 'shasumMatch',
    //   conditionals: ['view_shasum', 'view_all']
    // },
  
    {
      header: 'Git Stash',
      value: 'gitStashString',
      conditionals: ['view_git_stash', 'view_all']
    },

    {
      header: 'Current Branch',
      value: 'currentBranchString'
    },
  
    {
      header: 'Integration Branch',
      value: 'integrationBranchString'
    },
    
    {
      header: 'All Local Branches',
      value: 'allLocalBranchesString'
    },

    // {
    //   header: 'Clean?',
    //   value: 'workingDirectoryClean'
    // },
    //
    // {
    //   header: 'Up-to-Date w/ remote?',
    //   value: 'upToDateWithRemote'
    // },

    {
      header: 'Path',
      value: 'pathString',
      conditionals: ['view_packages_path', 'view_all']
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



