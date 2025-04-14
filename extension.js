const vscode = require('vscode');
const { initCommand } = require('./src/frame/command');
const { initSetting } = require('./src/frame/setting');
const { initStatusbar } = require('./src/frame/statusbar');
const { initOutputChannel, destroyOutputChannel } = require('./src/frame/channel');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	initOutputChannel();
	initSetting(context);
	initStatusbar(context);
	initCommand(context);
}

// This method is called when your extension is deactivated
function deactivate() {
	destroyOutputChannel();
}

module.exports = {
	activate,
	deactivate
}
