const octopus = require("./index");
const args = process.argv;
args.splice(0, 2);

let config;
if (args.length === 1) {
	const path = require("path");
	config = require(path.resolve(args[0]));
}

octopus.runConfig(config, function (err) {
	if (err) {
		throw err;
	}
});