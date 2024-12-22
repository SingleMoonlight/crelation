const vscode = require('vscode');
const { initCommand } = require('./src/frame/command');
const { initSetting } = require('./src/frame/setting');
const { initStatusbar } = require('./src/frame/statusbar');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	initSetting();
	initStatusbar(context);
	initCommand(context);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
