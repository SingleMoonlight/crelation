const vscode = require('vscode');
const project = require('./project');
const parse = require('./parse');
const statusbar = require('../frame/statusbar');
const { print, createTimer } = require('../frame/channel');
const { createWebviewPanel, showInRelationsView } = require('../frame/webview');
const { showInfoMessage } = require('../frame/message');
const { getAutoInitDatabase, getAutoUpdateInterval, getRelationPosition } = require('../frame/setting');
const { ErrorHandler, ErrorCodes } = require('./error');
const { getDatabaseManager } = require('./database');
const { setProgress } = statusbar;

/** @type {NodeJS.Timeout | undefined} */
let autoUpdateTimer;

/**
 * 初始化项目数据库
 */
async function initDatabase() {
    return await ErrorHandler.executeWithErrorHandling(async () => {
        const projectPath = project.getProjectPath();
        if (!projectPath) {
            throw ErrorHandler.create(ErrorCodes.NO_PROJECT_OPEN, 'No project is currently open');
        }

        await project.addProject();
        
        statusbar.showStatusbarItem();
        statusbar.setStatusbarText('Initializing...', true);
        showInfoMessage('Init database');

        const timer = createTimer('Init Database');
        
        // 使用进度回调
        await parse.traverseDirectory(projectPath, true, (current, total, filename) => {
            setProgress(current, total, `Scanning`);
            print('debug', `Processing ${current}/${total}: ${filename}`);
        });
        
        timer.stop();

        showInfoMessage(`Init database complete`);
        statusbar.hideStatusbarItem();
        
        // 清除缓存，确保下次读取最新数据
        getDatabaseManager().clearCache();
    }, 'initDatabase', { showToUser: true });
}

/**
 * 更新项目数据库
 */
async function updateDatabase() {
    return await ErrorHandler.executeWithErrorHandling(async () => {
        const projectPath = project.getProjectPath();
        if (!projectPath) {
            throw ErrorHandler.create(ErrorCodes.NO_PROJECT_OPEN, 'No project is currently open');
        }

        statusbar.showStatusbarItem();
        statusbar.setStatusbarText('Updating...', true);
        showInfoMessage('Update database');

        const timer = createTimer('Update Database');
        
        // 使用进度回调
        await parse.traverseDirectory(projectPath, false, (current, total, filename) => {
            setProgress(current, total, `Updating`);
            print('debug', `Processing ${current}/${total}: ${filename}`);
        });
        
        timer.stop();

        showInfoMessage(`Update database complete`);
        statusbar.hideStatusbarItem();
        
        getDatabaseManager().clearCache();
    }, 'updateDatabase', { showToUser: true });
}

/**
 * 强制更新项目数据库
 */
async function forceUpdateDatabase() {
    return await ErrorHandler.executeWithErrorHandling(async () => {
        const projectPath = project.getProjectPath();
        if (!projectPath) {
            throw ErrorHandler.create(ErrorCodes.NO_PROJECT_OPEN, 'No project is currently open');
        }

        statusbar.showStatusbarItem();
        statusbar.setStatusbarText('Force updating...', true);
        showInfoMessage('Force update database');

        const timer = createTimer('Force Update Database');
        
        // 使用进度回调
        await parse.traverseDirectory(projectPath, true, (current, total, filename) => {
            setProgress(current, total, `Force updating`);
            print('debug', `Processing ${current}/${total}: ${filename}`);
        });
        
        timer.stop();

        showInfoMessage(`Force update database complete`);
        statusbar.hideStatusbarItem();
        
        getDatabaseManager().clearCache();
    }, 'forceUpdateDatabase', { showToUser: true });
}

/**
 * 自动初始化项目数据库
 */
async function autoInitDatabase() {
    if (getAutoInitDatabase()) {
        print('info', 'Auto init database enabled.');
        await initDatabase();
    }
}

/**
 * 自动更新项目数据库
 * @param {vscode.ExtensionContext} context
 */
async function autoUpdateDatabase(context) {
    const interval = getAutoUpdateInterval();

    if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
    }

    if (interval > 0) {
        print('info', `Auto update database enabled with interval: ${interval} minutes.`);
        
        autoUpdateTimer = setInterval(async () => {
            await ErrorHandler.executeWithErrorHandling(async () => {
                const projectPath = project.getProjectPath();
                if (!projectPath) {
                    return;
                }

                print('info', 'Auto update database triggered.');
                statusbar.showStatusbarItem();
                statusbar.setStatusbarText('Auto updating...', true);

                // 自动更新不显示进度条，但记录日志
                await parse.traverseDirectory(projectPath, false, (current, total) => {
                    print('debug', `Auto update progress: ${current}/${total}`);
                });

                statusbar.hideStatusbarItem();
                getDatabaseManager().clearCache();
            }, 'autoUpdateDatabase', { showToUser: false });
        }, interval * 60 * 1000); // 转换为毫秒

        // 注册定时器到订阅列表
        context.subscriptions.push({
            dispose: () => clearInterval(autoUpdateTimer)
        });
    }
}

/**
 * 显示函数关系图
 * @param {vscode.ExtensionContext} context
 */
async function showRelations(context) {
    return await ErrorHandler.executeWithErrorHandling(async () => {
        // 获取当前选中的文本
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            showInfoMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text || text.trim() === '') {
            showInfoMessage('Please select a function name');
            return;
        }

        // 查找调用链
        const result = await parse.getFunctionCalls(text);
        
        if (!result[text] || result[text].calledBy.length === 0) {
            showInfoMessage(`No relations found for function "${text}"`);
            return;
        }
        
        // 根据配置决定在底部面板还是编辑器标签页中显示
        if (getRelationPosition() === 'bottom') {
            await showInRelationsView(text, result);
        } else {
            createWebviewPanel(context, text, result);
        }
        print('info', `Showing relations for function: ${text}`);
    }, 'showRelations', { showToUser: true });
}

module.exports = {
    initDatabase,
    updateDatabase,
    forceUpdateDatabase,
    autoInitDatabase,
    autoUpdateDatabase,
    showRelations
}
