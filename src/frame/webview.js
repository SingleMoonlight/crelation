const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * 创建调用关系的树形图
 * @param {vscode.ExtensionContext} context
 * @param {object} treeDate
 */
function createWebview(context, treeDate) {
    const panel = vscode.window.createWebviewPanel(
        'showRelations',
        'Function Call Relations',
        vscode.ViewColumn.One,
        {
            enableScripts: true, // 启用JS，默认禁用
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'view'))]
        }
    );

    let htmlContent = getWebviewContentWithConvertedPaths(panel, context, 'src/view/tree.html');
    htmlContent = htmlContent.replace('%%TREE_DATA%%', JSON.stringify({
        name: "root",
        children: [
            {
                name: "bar",
                children: [
                    { name: "foo" },
                    { name: "baz" }
                ]
            }
        ]
    }));
    panel.webview.html = htmlContent;
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
