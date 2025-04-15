const fs = require('fs').promises;
const path = require('path');
const Parser = require('tree-sitter');
const CParser = require('tree-sitter-c');
const { getProjectPath, getProjectDatabasePath } = require('./project');

// 初始化 C 语言解析器
const parser = new Parser();
parser.setLanguage(CParser);

// 定义输出文件名
const functionDefinitionsFile = 'function_definitions.json';
const functionCallsFile = 'function_calls.json';

/**
 * 递归遍历目录并解析代码文件
 * @param {string} dir 要扫描的目录路径
 * @param {boolean} forceRescan 是否强制重新扫描（暂未实现）
 */
async function traverseDirectory(dir, forceRescan = false) {
    // 创建存储数据结构
    const functionDefinitions = {}; // 函数定义存储 {函数名: [...]}
    const functionCalls = {};        // 函数调用关系存储 {被调函数: ...}

    // 处理单个文件
    async function processFile(filePath) {
        const code = await fs.readFile(filePath, 'utf-8');
        const tree = parser.parse(code);
        const relativePath = path.relative(await getProjectPath(), filePath);

        // 使用栈结构维护函数上下文
        const functionStack = [];

        // 递归遍历AST
        function traverse(node) {
            // 处理函数定义
            if (node.type === 'function_definition') {
                // 查找函数名标识符
                const declarator = node.childForFieldName('declarator');
                const functionName = findFunctionName(declarator);

                if (functionName) {
                    // 记录函数定义
                    (functionDefinitions[functionName] ||= []).push({
                        filePath: relativePath,
                        lineNumber: node.startPosition.row + 1
                    });

                    // 压入上下文栈
                    functionStack.push(functionName);
                }
            }

            // 处理函数调用
            if (node.type === 'call_expression') {
                const functionNode = node.childForFieldName('function');
                if (functionNode?.type === 'identifier') {
                    const calleeName = functionNode.text;
                    const callerName = functionStack[functionStack.length - 1] || 'global';

                    // 记录调用关系
                    (functionCalls[calleeName] ||= { calledBy: [] }).calledBy.push({
                        caller: callerName,
                        filePath: relativePath,
                        lineNumber: node.startPosition.row + 1
                    });
                }
            }

            // 递归处理子节点
            node.children.forEach(traverse);

            // 弹出上下文栈
            if (node.type === 'function_definition' && functionStack.length > 0) {
                functionStack.pop();
            }
        }

        traverse(tree.rootNode);
    }

    // 辅助函数：查找函数名
    function findFunctionName(node) {
        if (!node) return null;

        // 深度优先搜索identifier
        if (node.type === 'identifier') {
            return node.text;
        }

        for (const child of node.children) {
            const result = findFunctionName(child);
            if (result) return result;
        }

        return null;
    }

    // 递归目录遍历函数
    async function walk(currentDir) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath); // 递归处理子目录
            } else if (['.c', '.h'].includes(path.extname(fullPath))) {
                await processFile(fullPath); // 处理C文件
            }
        }
    }

    // 开始遍历
    await walk(dir);

    // 写入结果文件
    const dbPath = await getProjectDatabasePath();
    await fs.writeFile(
        path.join(dbPath, functionDefinitionsFile),
        JSON.stringify(functionDefinitions, null, 2)
    );
    await fs.writeFile(
        path.join(dbPath, functionCallsFile),
        JSON.stringify(functionCalls, null, 2)
    );
}

/**
 * 查询函数定义信息
 * @param {string} functionName 要查询的函数名
 * @returns {Promise<Array>} 函数定义位置数组
 */
async function getFunctionDefinition(functionName) {
    const dbPath = await getProjectDatabasePath();
    try {
        const data = await fs.readFile(path.join(dbPath, functionDefinitionsFile), 'utf-8');
        return JSON.parse(data)[functionName] || [];
    } catch {
        return []; // 文件不存在时返回空数组
    }
}

/**
 * 查询函数调用关系
 * @param {string} functionName 要查询的函数名
 * @returns {Promise<Object>} 调用关系对象
 */
async function getFunctionCalls(functionName) {
    const dbPath = await getProjectDatabasePath();
    try {
        const data = await fs.readFile(path.join(dbPath, functionCallsFile), 'utf-8');
        const allCalls = JSON.parse(data);
        
        // 添加外层函数名包装
        return {
            [functionName]: allCalls[functionName] || { calledBy: [] }
        };
    } catch {
        // 异常时返回带函数名的空结构
        return {
            [functionName]: { calledBy: [] }
        };
    }
}

module.exports = {
    traverseDirectory,
    getFunctionDefinition,
    getFunctionCalls
};