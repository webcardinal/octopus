const octopus = require("./index");

args.splice(0, 2);

const config;
if (args.length === 1) {
	config = require(args[0])
}

octopus.runConfig(config, function (err) {
	if (err) {
		throw err;
	}
});