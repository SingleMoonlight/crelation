const vscode = require('vscode');
const api = require('./api');

/**
 * @param {vscode.ExtensionContext} context
 * @param {string} commandName
 * @param {any} callback
 */
function registerCommand(context, commandName, callback) {
	let disposable = vscode.commands.registerCommand(commandName, callback);
	context.subscriptions.push(disposable);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function initCommand(context)
{
	registerCommand(context, 'crelation.init', api.initDatabase);
	registerCommand(context, 'crelation.update', api.updateDatabase);
	registerCommand(context, 'crelation.forceUpdate', api.forceUpdateDatabase);
}

module.exports = {
	initCommand
}