const vscode = require('vscode');

/**
 * 显示信息消息
 * @param {string} message
 */
function showInfoMessage(message) {
    vscode.window.showInformationMessage(message);
}

/**
 * 显示警告消息
 * @param {string} message
 */
function showWarningMessage(message) {
    vscode.window.showWarningMessage(message);
}

/**
 * 显示错误消息
 * @param {string} message
 */
function showErrorMessage(message) {
    vscode.window.showErrorMessage(message);
}

module.exports = { 
    showInfoMessage,
    showWarningMessage,
    showErrorMessage
};