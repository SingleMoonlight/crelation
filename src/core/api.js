const vscode = require('vscode');
const project = require('./project');
const parse = require('./parse');
const statusbar = require('../frame/statusbar');
const { createWebview } = require('../frame/webview');
const { showInfoMessage } = require('../frame/message');

/**
 * 初始化项目数据库
 * @param {vscode.ExtensionContext} context
 */
async function initDatabase(context) {
    const projectPath = project.getProjectPath();
    await project.addProject();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...', true);

    showInfoMessage('Init database');

    // 记录开始时间
    const startTime = Date.now();

    await parse.traverseDirectory(projectPath, true);
    // 计算耗时
    const endTime = Date.now();
    const duration = endTime - startTime;

    // 格式化耗时
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const milliseconds = duration % 1000;

    const formattedDuration = `${minutes} min ${seconds.toString().padStart(2, '0')} sec ${milliseconds.toString().padStart(3, '0')} ms`;

    showInfoMessage(`Init database complete in ${formattedDuration}`);
    statusbar.hideStatusbarItem();
}

/**
 * 更新项目数据库
 * @param {vscode.ExtensionContext} context
 */
async function updateDatabase(context) {
    const projectPath = project.getProjectPath();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...', true);

    showInfoMessage('Update database');

    // 记录开始时间
    const startTime = Date.now();

    await parse.traverseDirectory(projectPath, false);
    // 计算耗时
    const endTime = Date.now();
    const duration = endTime - startTime;

    // 格式化耗时
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const milliseconds = duration % 1000;

    const formattedDuration = `${minutes} min ${seconds.toString().padStart(2, '0')} sec ${milliseconds.toString().padStart(3, '0')} ms`;

    showInfoMessage(`Update database complete in ${formattedDuration}`);
    statusbar.hideStatusbarItem();
}

/**
 * 强制更新项目数据库
 * @param {vscode.ExtensionContext} context
 */
async function forceUpdateDatabase(context) {
    const projectPath = project.getProjectPath();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...', true);

    showInfoMessage('Force update database');

    // 记录开始时间
    const startTime = Date.now();

    await parse.traverseDirectory(projectPath, true);
    // 计算耗时
    const endTime = Date.now();
    const duration = endTime - startTime;

    // 格式化耗时
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const milliseconds = duration % 1000;

    const formattedDuration = `${minutes} min ${seconds.toString().padStart(2, '0')} sec ${milliseconds.toString().padStart(3, '0')} ms`;

    showInfoMessage(`Force update database complete in ${formattedDuration}`);
    statusbar.hideStatusbarItem();
}

/**
 * 显示函数关系图
 * @param {vscode.ExtensionContext} context
 */
async function showRelations(context) {
    // 获取当前选中的文本
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text || text.trim() === '') {
        return;
    }

    // 查找调用链
    let result = null;
    result = await parse.getFunctionCalls(text);
    if (result[text].calledBy.length === 0) {
        showInfoMessage('No relations found for function "' + text + '"');
        return;
    }
    createWebview(context, text, result);

    if (result === null) {
        showInfoMessage('Query relations failed');
    }
}

module.exports = {
    initDatabase,
    updateDatabase,
    forceUpdateDatabase,
    showRelations
}
