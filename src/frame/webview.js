const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const parse = require('../core/parse');
const { print } = require('../frame/channel');
const { getProjectPath } = require('../core/project');
const { showInfoMessage } = require('./message');
const { getRelationPosition, getRelationTabMode } = require('./setting');
const { ErrorHandler } = require('../core/error');

/** @typedef {import('../core/database').FunctionCalls} FunctionCalls */

/**
 * webview 发来的消息
 * @typedef {Object} WebviewMessage
 * @property {string} command 命令名
 * @property {string} [nodeName] 待展开的函数名
 * @property {{ filePath: string, lineNumber: number }} [functionCallerInfo] 调用点信息
 */

// 底部面板中视图的ID，必须与 package.json 中 contributes.views 的配置保持一致
const RELATIONS_VIEW_ID = 'crelation.relationsView';

// 当前Webview面板实例，在单标签页模式下有效
/** @type {vscode.WebviewPanel | null} */
let currentPanel = null;

// 当前Webview视图实例，在面板模式下有效
/** @type {vscode.WebviewView | null} */
let relationsView = null;
// 视图本轮解析挂上的订阅，视图被重新解析或销毁时需要释放
/** @type {vscode.Disposable[]} */
let relationsViewDisposables = [];
// 最近一次查询的函数名和数据，视图未解析或已被销毁时暂存，待视图可见后补发
/** @type {FunctionCalls | null} */
let lastTreeData = null;
/** @type {string | null} */
let lastFuncName = null;

/**
 * 创建调用关系的树形图（编辑器标签页模式）
 * @param {vscode.ExtensionContext} context
 * @param {string} text 查询的函数名
 * @param {FunctionCalls} treeData 查询的函数掉用关系数据
 */
function createWebviewPanel(context, text, treeData) {
    const position = getRelationPosition();
    const tabMode = getRelationTabMode();
    let column = vscode.ViewColumn.One;

    if (position === 'default') {
        column = vscode.ViewColumn.One;
    } else if (position === 'right') {
        column = vscode.ViewColumn.Two;
    }

    // 复用现有面板
    if (tabMode === 'single' && currentPanel) {
        // 更新标题和数据
        currentPanel.title = text;
        currentPanel.webview.postMessage({ command: 'receiveTreeData', treeData });
        currentPanel.reveal(column);
        print('info', 'Reusing existing panel.');
        return;
    }

    print('info', 'Creating new panel.');
    const panel = vscode.window.createWebviewPanel(
        'CRelations',
        text,
        column,
        {
            ...createWebviewOptions(context),
            retainContextWhenHidden: true
        }
    );

    // 状态管理
    currentPanel = panel;
    panel.onDidDispose(() => {
        if (currentPanel === panel) {
            currentPanel = null;
        }
    }, null, context.subscriptions);

    panel.webview.html = getWebviewContentWithConvertedPaths(panel.webview, context, 'src/view/index.html');
    panel.webview.postMessage({ command: 'receiveTreeData', treeData });

    // 设置消息监听器
    panel.webview.onDidReceiveMessage(
        message => handleWebviewMessage(panel.webview, message),
        undefined,
        context.subscriptions
    );
}

/**
 * 在底部面板的视图中显示调用关系（面板模式）
 * @param {string} text 查询的函数名
 * @param {FunctionCalls} treeData 查询的函数掉用关系数据
 */
async function showInRelationsView(text, treeData) {
    lastTreeData = treeData;
    lastFuncName = text;

    if (relationsView) {
        relationsView.title = text;
        relationsView.webview.postMessage({ command: 'receiveTreeData', treeData });
        print('info', 'Showing relations in the bottom panel.');
    } else {
        // 视图还没被解析（用户没打开过该视图），数据先暂存，等 resolveWebviewView 时补发
        print('info', 'Relations view is not resolved yet, deferring the tree data.');
    }

    // 激活底部面板并切换到该视图
    await vscode.commands.executeCommand(`${RELATIONS_VIEW_ID}.focus`);
}

/**
 * 释放视图本轮解析挂上的订阅
 */
function disposeRelationsViewSubscriptions() {
    relationsViewDisposables.forEach(disposable => disposable.dispose());
    relationsViewDisposables = [];
}

/**
 * 注册底部面板中的调用关系视图
 * @param {vscode.ExtensionContext} context
 */
function initRelationsView(context) {
    const provider = {
        /**
         * 解析Webview视图，视图首次显示、以及被隐藏后再次显示时都会调用
         * @param {vscode.WebviewView} webviewView
         */
        resolveWebviewView(webviewView) {
            // 视图隐藏后再次显示时会被重新解析，先释放上一轮的订阅
            disposeRelationsViewSubscriptions();

            relationsView = webviewView;

            webviewView.webview.options = createWebviewOptions(context);
            webviewView.webview.html = getWebviewContentWithConvertedPaths(webviewView.webview, context, 'src/view/index.html');

            // 这两个订阅只服务于本次解析，随视图销毁一起释放。
            // 不能推进 context.subscriptions —— 那个数组在整个窗口生命周期内不会被清理，
            // 每次重新解析都会多留一份，闭包还会一直持有已经失效的 webviewView
            relationsViewDisposables = [
                webviewView.webview.onDidReceiveMessage(
                    message => handleWebviewMessage(webviewView.webview, message)
                ),
                webviewView.onDidDispose(() => {
                    disposeRelationsViewSubscriptions();
                    if (relationsView === webviewView) {
                        relationsView = null;
                    }
                })
            ];

            // 视图被重新解析时补发上次的数据，避免切到其他标签再切回来后画面空白
            if (lastTreeData) {
                webviewView.title = lastFuncName ?? undefined;
                webviewView.webview.postMessage({ command: 'receiveTreeData', treeData: lastTreeData });
                print('info', 'Restored the last relations data.');
            }
        }
    };

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(RELATIONS_VIEW_ID, provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // 显示位置改变时刷新占位提示，说明结果会显示在哪里
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('crelation.relationsPosition') && relationsView) {
                postRelationPosition(relationsView.webview);
            }
        })
    );

    print('info', `Registered the relations view: ${RELATIONS_VIEW_ID}`);
}

/**
 * 生成Webview的配置项，标签页和面板两种承载方式共用
 * @param {vscode.ExtensionContext} context
 * @returns {vscode.WebviewOptions} Webview配置
 */
function createWebviewOptions(context) {
    return {
        enableScripts: true, // 启用JS，默认禁用
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'view'))]
    };
}

/**
 * 把结果显示位置同步给webview，用于渲染占位提示的文案
 * @param {vscode.Webview} webview
 */
function postRelationPosition(webview) {
    webview.postMessage({
        command: 'updatePosition',
        position: getRelationPosition(),
        // 只有底部面板视图会长期为空，编辑器标签页创建时就有数据，不需要占位提示
        host: relationsView && webview === relationsView.webview ? 'view' : 'panel'
    });
}

/**
 * 处理来自Webview的消息，标签页和面板两种承载方式共用
 * @param {vscode.Webview} webview 消息来源的Webview实例
 * @param {WebviewMessage} message 消息内容
 */
async function handleWebviewMessage(webview, message) {
    return await ErrorHandler.executeWithErrorHandling(async () => {
        switch (message.command) {
            case 'requestPosition':
                postRelationPosition(webview);
                return;

            case 'useBottomPosition':
                // 占位提示里的按钮：把结果显示位置切到本面板
                // 写入用户设置，随后会触发 onDidChangeConfiguration 刷新占位提示
                await vscode.workspace.getConfiguration('crelation').update('relationsPosition', 'bottom', true);
                print('info', 'Switched relationsPosition to bottom.');
                return;

            case 'fetchChildNodes':
                const nodeName = message.nodeName;
                if (!nodeName) {
                    return;
                }
                const childNodes = await parse.getFunctionCalls(nodeName);
                if (childNodes[nodeName].calledBy.length === 0) {
                    showInfoMessage(`No relations found for function "${nodeName}"`);
                    return;
                }
                // 发送消息回webview
                webview.postMessage({ command: 'receiveChildNodes', childNodes });
                print('debug', `Fetched child nodes for: ${nodeName}`);
                return;

            case 'sendFunctionCallerInfo':
                const functionCallerInfo = message.functionCallerInfo;
                const projectPath = getProjectPath();
                if (!functionCallerInfo || !projectPath) {
                    return;
                }

                const filePath = path.join(projectPath, functionCallerInfo.filePath);
                const lineNumber = functionCallerInfo.lineNumber;

                const doc = await vscode.workspace.openTextDocument(filePath);
                const editor = await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.One, // 强制在第一个视图列打开
                    selection: new vscode.Range(
                        new vscode.Position(lineNumber - 1, 0),
                        new vscode.Position(lineNumber - 1, 0)
                    )
                });
                editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenter);
                print('info', `Jumped to ${filePath}:${lineNumber}`);
                return;

            default:
                return;
        }
    }, 'webviewMessageHandler', { showToUser: true });
}

/**
 * 将HTML文件中的资源路径转换为Webview可用的路径
 * @param {vscode.Webview} webview Webview实例
 * @param {string} htmlContent 原始HTML文件内容
 * @param {string} extensionPath 扩展根目录路径
 */
function convertLocalPathsToWebviewUri(webview, htmlContent, extensionPath) {
    // 使用正则表达式匹配所有资源路径
    const regex = /(<img src="|<script src="|<link href=")(.+?)"/g;
    return htmlContent.replace(regex, (match, prefix, url) => {
        // 检查是否为相对路径
        if (!url.startsWith('http') && !url.startsWith('data:')) {
            // 转换为绝对路径
            const absolutePath = path.join(extensionPath, url);
            // 使用asWebviewUri转换路径
            const webviewUri = webview.asWebviewUri(vscode.Uri.file(absolutePath));
            return prefix + webviewUri + '"';
        }
        return match;
    });
}

/**
 * 读取HTML文件并替换资源路径
 * @param {vscode.Webview} webview Webview实例
 * @param {vscode.ExtensionContext} context 扩展上下文
 * @param {string} relativePath 相对于扩展根目录的HTML文件路径
 */
function getWebviewContentWithConvertedPaths(webview, context, relativePath) {
    const extensionPath = context.extensionPath;
    const htmlPath = path.join(extensionPath, relativePath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 替换资源路径
    const convertedContent = convertLocalPathsToWebviewUri(webview, htmlContent, extensionPath);

    // 返回转换后的HTML内容
    return convertedContent;
}

module.exports = { createWebviewPanel, showInRelationsView, initRelationsView };
