const vscode = require('vscode');
const api = require('../core/api');
const setting = require('./setting');

/**
 * 注册命令
 * @param {vscode.ExtensionContext} context
 * @param {string} commandName
 * @param {any} callback
 */
function registerCommand(context, commandName, callback) {
	let disposable = vscode.commands.registerCommand(commandName, () => callback(context));
	context.subscriptions.push(disposable);
}

/**
 * 初始化命令
 * @param {vscode.ExtensionContext} context
 */
function initCommand(context)
{
	registerCommand(context, 'crelation.init', api.initDatabase);
	registerCommand(context, 'crelation.update', api.updateDatabase);
	registerCommand(context, 'crelation.forceUpdate', api.forceUpdateDatabase);
	registerCommand(context, 'crelation.showRelations', api.showRelations);

	if (setting.getAutoInitDatabase()) {
		api.initDatabase(context);
	}
}

module.exports = {
	initCommand
}