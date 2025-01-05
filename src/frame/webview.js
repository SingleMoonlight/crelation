const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const parse = require('../core/parse');
const { print } = require('../util/log');
const { getProjectPath } = require('../core/project');
const { showInfoMessage } = require('./message');

/**
 * 创建调用关系的树形图
 * @param {vscode.ExtensionContext} context
 * @param {object} treeData
 */
function createWebview(context, treeData) {
    const panel = vscode.window.createWebviewPanel(
        'CRelations',
        'CRelations',
        vscode.ViewColumn.One,
        {
            enableScripts: true, // 启用JS，默认禁用
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'view'))],
            retainContextWhenHidden: true
        }
    );

    let htmlContent = getWebviewContentWithConvertedPaths(panel, context, 'src/view/index.html');
    panel.webview.html = htmlContent;
    panel.webview.postMessage({ command: 'receiveTreeData', treeData });

    // 设置消息监听器
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'fetchChildNodes':
                    const nodeName = message.nodeName;
                    parse.getFunctionCalls(nodeName).then(childNodes => {
                        if (childNodes[nodeName].calledBy.length === 0) {
                            showInfoMessage('No relations found for function "' + nodeName + '"');
                            return;
                        }
                        // 发送消息回webview
                        panel.webview.postMessage({ command: 'receiveChildNodes', childNodes });
                    }).catch((err) => {
                        print('error', err);
                    });
                    return;
                case 'sendFunctionCallerInfo':
                    const functionCallerInfo = message.functionCallerInfo;
                    const filePath = path.join(getProjectPath(), functionCallerInfo.filePath);
                    const lineNumber = functionCallerInfo.lineNumber;

                    // 控制vscode编辑器跳转到指定文件和行号
                    vscode.workspace.openTextDocument(filePath).then(doc => {
                        vscode.window.showTextDocument(doc).then(editor => {
                            const position = new vscode.Position(lineNumber, 0);
                            editor.selection = new vscode.Selection(position, position);
                            editor.revealRange(new vscode.Range(position, position));
                        });
                    });
                default:
                    return;
            }
        },
        undefined,
        context.subscriptions
    );
}

/**
 * 将HTML文件中的资源路径转换为Webview可用的路径
 * @param {vscode.WebviewPanel} panel Webview面板实例
 * @param {string} htmlContent 原始HTML文件内容
 * @param {string} extensionPath 扩展根目录路径
 */
function convertLocalPathsToWebviewUri(panel, htmlContent, extensionPath) {
    // 使用正则表达式匹配所有资源路径
    const regex = /(<img src="|<script src="|<link href=")(.+?)"/g;
    return htmlContent.replace(regex, (match, prefix, url) => {
        // 检查是否为相对路径
        if (!url.startsWith('http') && !url.startsWith('data:')) {
            // 转换为绝对路径
            const absolutePath = path.join(extensionPath, url);
            // 使用asWebviewUri转换路径
            const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(absolutePath));
            return prefix + webviewUri + '"';
        }
        return match;
    });
}

/**
 * 读取HTML文件并替换资源路径
 * @param {vscode.WebviewPanel} panel Webview面板实例
 * @param {vscode.ExtensionContext} context 扩展上下文
 * @param {string} relativePath 相对于扩展根目录的HTML文件路径
 */
function getWebviewContentWithConvertedPaths(panel, context, relativePath) {
    const extensionPath = context.extensionPath;
    const htmlPath = path.join(extensionPath, relativePath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 替换资源路径
    const convertedContent = convertLocalPathsToWebviewUri(panel, htmlContent, extensionPath);

    // 返回转换后的HTML内容
    return convertedContent;
}

module.exports = { createWebview };
