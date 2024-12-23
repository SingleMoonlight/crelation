const vscode = require('vscode');
const project = require('./project');
const parse = require('./parse');
const statusbar = require('../frame/statusbar');
const { showInfoMessage } = require('../frame/message');

/**
 * 初始化项目数据库
 */
function initDatabase() {
    const projectPath = project.getProjectPath();
    project.addProject();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...');

    showInfoMessage('Init database');

    // 记录开始时间
    const startTime = Date.now();

    parse.traverseDirectory(projectPath, true).then(() => {
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
    }).catch(() => {
        showInfoMessage('Init database failed');
        statusbar.hideStatusbarItem();
    });
}

/**
 * 更新项目数据库
 */
function updateDatabase() {
    const projectPath = project.getProjectPath();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...');

    showInfoMessage('Update database');

    // 记录开始时间
    const startTime = Date.now();

    parse.traverseDirectory(projectPath, false).then(() => {
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
    }).catch(() => {
        showInfoMessage('Update database failed');
        statusbar.hideStatusbarItem();
    });
}

/**
 * 强制更新项目数据库
 */
function forceUpdateDatabase() {
    const projectPath = project.getProjectPath();

    statusbar.showStatusbarItem();
    statusbar.setStatusbarText('Scanning...');

    showInfoMessage('Force update database');

    // 记录开始时间
    const startTime = Date.now();

    parse.traverseDirectory(projectPath, true).then(() => {
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
    }).catch(() => {
        showInfoMessage('Force update database failed');
        statusbar.hideStatusbarItem();
    });
}

/**
 * 显示函数关系图
 */
function showRelations() {
    // 获取当前选中的文本
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    // 查找调用链
    parse.getFunctionCalls(text).then(result => {
        showInfoMessage('Query relations result: ' + JSON.stringify(result));
    }).catch(() => {
        showInfoMessage('Query relations failed');
    });
}

module.exports = {
    initDatabase,
    updateDatabase,
    forceUpdateDatabase,
    showRelations
}
