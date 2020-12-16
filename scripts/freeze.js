/**
 * Called by npm (using the package.json configuration) from
 *  "freeze" hook
 * npm -> package.json -> [scripts]/freeze.js
 * */

const fsExt = require('../lib/utils/FSExtension').fsExt;
const octopus = require("./index");
const path = require("path");
const fs = require("fs");
const child_process = require('child_process');


// Save current config file
currentConfigFile = octopus.getConfigFile();

// Ensure that we are switched to DEV configuration
octopus.changeConfigFile('./octopus-dev.json');

let config =  octopus.readConfig();

/**Performs a freeze on current configuration loaded from file (octopus.json or octopus-dev.json) */
function freezeConfig(config){

    function updateSmartCloneAction(dependency, action){
        /**
         * If the action has the commit no - ignore it
         * Else take current commit no (current head) from git
         */
        // if(typeof action.commit == "undefined"){
            console.log("Found " + action.type + " to be ready for update");          
            var targetFolder = fsExt.resolvePath(path.join(config.workDir, dependency.name));
            console.log("Dependency folder: " + targetFolder);

            basicProcOptions = {cwd: targetFolder};

            if (fs.existsSync(targetFolder) && fs.readdirSync(targetFolder).length > 0 ) {

                //Get commit number 
                try {
                    let out = child_process.execSync("git rev-parse HEAD", basicProcOptions).toString().trim();
                    if(out.length == 40){
                        action.commit = out;
                    }
                } catch (err) {
                    console.log(err);
                }
            }
            else{
                console.log("Folder/Repo " + targetFolder + " not available. Please make sure all repositories were pulled and updated to correct version");
            }
        // }
    }

    for (i=0;i<config.dependencies.length; i++){        
        let dep = config.dependencies[i];
        for(j=0;j<dep.actions.length; j++){
            let action = dep.actions[j];
            if(action.type == 'smartClone'){
                updateSmartCloneAction(dep, action);
            }
        }
    }

}

//Update config
freezeConfig(config);

//Switch to stable octopus
octopus.changeConfigFile('./octopus.json');

//Save it
octopus.updateConfig(config, (err) => {
    if(err){
        throw err;
    }

    console.log("Configuration file  " + octopus.getConfigFile() +  " updated.")

    //Change back to original config file
    octopus.changeConfigFile(currentConfigFile);
});

