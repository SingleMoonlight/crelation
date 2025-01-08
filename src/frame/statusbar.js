const vscode = require('vscode');

const textPrefix = 'C Relation: ';
let statusbarItem = null;
let isLoading = false;

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
    isLoading = false;
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
 * @param {boolean} isLoading - 是否显示加载图标
 */
function setStatusbarText(text, isLoading = false) {
    if (isLoading) {
        statusbarItem.text = `$(sync~spin) ${textPrefix}${text}`;
        isLoading = true;
    } else {
        statusbarItem.text = `${textPrefix}${text}`;
        isLoading = false;
    }
}

module.exports = {
    initStatusbar,
    hideStatusbarItem,
    showStatusbarItem,
    setStatusbarText
};
