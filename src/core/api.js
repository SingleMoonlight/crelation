const vscode = require('vscode');
const project = require('./project');
const parse = require('./parse');
const statusbar = require('../frame/statusbar');
const { createWebview } = require('../frame/webview');
const { showInfoMessage } = require('../frame/message');
const { print } = require('../util/log');

/**
 * 初始化项目数据库
 * @param {vscode.ExtensionContext} context
 */
function initDatabase(context) {
    const projectPath = project.getProjectPath();
    project.addProject();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...');

    showInfoMessage('Init database');

    // 记录开始时间
    const startTime = Date.now();

    parse.traverseDirectory(projectPath, true, false).then(() => {
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
    }).catch((err) => {
        print('error', err);
        showInfoMessage('Init database failed');
        statusbar.hideStatusbarItem();
    });
}

/**
 * 更新项目数据库
 * @param {vscode.ExtensionContext} context
 */
function updateDatabase(context) {
    const projectPath = project.getProjectPath();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...');

    showInfoMessage('Update database');

    // 记录开始时间
    const startTime = Date.now();

    parse.traverseDirectory(projectPath, false, false).then(() => {
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
    }).catch((err) => {
        print('error', err);
        showInfoMessage('Update database failed');
        statusbar.hideStatusbarItem();
    });
}

/**
 * 强制更新项目数据库
 * @param {vscode.ExtensionContext} context
 */
function forceUpdateDatabase(context) {
    const projectPath = project.getProjectPath();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...');

    showInfoMessage('Force update database');

    // 记录开始时间
    const startTime = Date.now();

    parse.traverseDirectory(projectPath, true, false).then(() => {
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
    }).catch((err) => {
        print('error', err);
        showInfoMessage('Force update database failed');
        statusbar.hideStatusbarItem();
    });
}

/**
 * 显示函数关系图
 * @param {vscode.ExtensionContext} context
 */
function showRelations(context) {
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
    parse.getFunctionCalls(text).then(result => {        
        if (result[text].calledBy.length === 0) {
            showInfoMessage('No relations found for function "' + text + '"');
            return;
        }
        createWebview(context, result);
    }).catch((err) => {     
        print('error', err); 
        showInfoMessage('Query relations failed');
    });
}

module.exports = {
    initDatabase,
    updateDatabase,
    forceUpdateDatabase,
    showRelations
}
