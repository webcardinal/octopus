function createAction(solution, walletName) {
	return {
		"type": "copy",
		"src": `./${walletName}/seed`,
		"target": `./web-server/${solution}/wallet-template/seed`,
		"options": {
			overwrite: true
		}
	};
}

module.exports = {createAction};