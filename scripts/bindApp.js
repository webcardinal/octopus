function createAction(solution, app) {
	return {
		"type": "copy",
		"src": `./${app}/seed`,
		"target": `./web-server/${solution}/apps/${app}/seed`,
		"options": {
			overwrite: true
		}
	};
}

module.exports = {createAction};