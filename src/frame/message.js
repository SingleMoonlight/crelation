const vscode = require('vscode');

/**
 * 显示信息消息
 * @param {string} message
 */
function showInfoMessage(message) {
    vscode.window.showInformationMessage(message);
}

module.exports = { showInfoMessage };