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
 * @param {boolean} loading - 是否显示加载图标
 */
function setStatusbarText(text, loading = false) {
    if (loading) {
        statusbarItem.text = `$(sync~spin) ${textPrefix}${text}`;
        isLoading = true;
    } else {
        statusbarItem.text = `${textPrefix}${text}`;
        isLoading = false;
    }
}

/**
 * 设置状态栏进度
 * @param {number} current 当前进度
 * @param {number} total 总进度
 * @param {string} message 额外消息
 */
function setProgress(current, total, message = '') {
    const percentage = Math.floor((current / total) * 100);
    const progressBar = generateProgressBar(percentage);
    const text = message ? `${message} ${progressBar} ${percentage}%` : `${progressBar} ${percentage}%`;
    statusbarItem.text = `${textPrefix}${text}`;
}

/**
 * 生成进度条
 * @param {number} percentage 百分比
 * @returns {string}
 */
function generateProgressBar(percentage) {
    const barLength = 10;
    const filled = Math.floor((percentage / 100) * barLength);
    const empty = barLength - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
    initStatusbar,
    hideStatusbarItem,
    showStatusbarItem,
    setStatusbarText,
    setProgress
};
