/**
 * Called by npm (using the package.json configuration) from
 *  "freeze" hook
 * npm -> package.json -> [scripts]/freeze.js
 * */

const args = process.argv;
args.splice(0, 2);

console.log("Arguments", args);

const octopus = require("./index");
let targets = ["dependencies"];

if(args.length > 0){
    targets = args;
}

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

    function updateSmartCloneAction(task, action){
        /**
         * If the action has the commit no - ignore it
         * Else take current commit no (current head) from git
         */
        // if(typeof action.commit == "undefined"){
            console.log("Found " + action.type + " to be ready for update");          
            var targetFolder = path.resolve(path.join(config.workDir, task.name));
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

    targets.forEach(target=>{
        let tasks = config[target];
        if(typeof tasks === "undefined"){
            return octopus.handleError(`Unable to find the task list called <${target}> in current config.`);
        }
        for (let i=0; i<tasks.length; i++){
            let task = tasks[i];
            for(let j=0;j<task.actions.length; j++){
                let action = task.actions[j];
                if(action.type == 'smartClone'){
                    updateSmartCloneAction(task, action);
                }
            }
        }
    });
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

