const octopus = require("./index");

global.collectLog = false;
octopus.runConfig( function (err) {
	if (err) {
		throw err;
	}
});