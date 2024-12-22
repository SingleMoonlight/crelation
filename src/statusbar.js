const vscode = require('vscode');

const textPrefix = 'CRelation: ';
let statusbarItem = null;

/**
 * 初始化状态栏
 * @param {vscode.ExtensionContext} context 
 */
function initStatusbar(context) {
    // 创建一个新的状态栏项
    statusbarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusbarItem.text = textPrefix;
    statusbarItem.hide();

    // 将状态栏项添加到插件的订阅中，以便在插件停用时能够正确清理
    context.subscriptions.push(statusbarItem);
}

/**
 * 隐藏状态栏
 */
function hideStatusbarItem() {
    statusbarItem.hide();
}

/**
 * 显示状态栏
 */
function showStatusbarItem() {
    statusbarItem.show();
}

/**
 * 设置状态栏文本
 * @param {string} text 
 */
function setStatusbarText(text) {
    statusbarItem.text = textPrefix + text;
}

module.exports = { 
    initStatusbar,
    hideStatusbarItem,
    showStatusbarItem,
    setStatusbarText
};
