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
const lastScanTimestampFile = 'last_scan_timestamp.json';

/**
 * 递归遍历目录并解析代码文件
 * @param {string} dir 要扫描的目录路径
 * @param {boolean} forceRescan 是否强制重新扫描
 */
async function traverseDirectory(dir, forceRescan = false) {
    const dbPath = await getProjectDatabasePath();
    let functionDefinitions = {};
    let functionCalls = {};
    let lastScanTime = 0;

    // 加载已有数据和上次扫描时间戳
    if (!forceRescan) {
        try {
            // 加载函数定义数据
            const defData = await fs.readFile(path.join(dbPath, functionDefinitionsFile), 'utf-8');
            functionDefinitions = JSON.parse(defData);

            // 加载调用关系数据
            const callData = await fs.readFile(path.join(dbPath, functionCallsFile), 'utf-8');
            functionCalls = JSON.parse(callData);

            // 加载上次扫描时间
            const timeData = await fs.readFile(path.join(dbPath, lastScanTimestampFile), 'utf-8');
            lastScanTime = JSON.parse(timeData).lastScanTime || 0;
        } catch {
            // 文件不存在时强制全量扫描
            forceRescan = true;
        }
    }

    // 记录需要处理的文件列表
    const processedFiles = new Set();

    // 处理单个文件
    async function processFile(filePath) {
        const relativePath = path.relative(await getProjectPath(), filePath);
        processedFiles.add(relativePath);

        // 清除旧数据
        for (const funcName in functionDefinitions) {
            functionDefinitions[funcName] = functionDefinitions[funcName]
                .filter(def => def.filePath !== relativePath);
            if (functionDefinitions[funcName].length === 0) {
                delete functionDefinitions[funcName];
            }
        }

        for (const calleeName in functionCalls) {
            functionCalls[calleeName].calledBy = functionCalls[calleeName].calledBy
                .filter(call => call.filePath !== relativePath);
            if (functionCalls[calleeName].calledBy.length === 0) {
                delete functionCalls[calleeName];
            }
        }

        // 解析新数据
        const code = await fs.readFile(filePath, 'utf-8');
        const tree = parser.parse(code);
        const functionStack = [];

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

    // 辅助函数：清理已删除文件的数据
    function cleanupDeletedFiles(dataSet, existingFiles) {
        for (const key in dataSet) {
            if (Array.isArray(dataSet[key])) {
                // 清理已删除文件的定义
                dataSet[key] = dataSet[key].filter(def =>
                    existingFiles.has(def.filePath)
                );
            } else if (dataSet[key]?.calledBy) {
                // 清理已删除文件的调用记录
                dataSet[key].calledBy = dataSet[key].calledBy.filter(call =>
                    existingFiles.has(call.filePath)
                );
            }

            // 清理空数据
            if ((Array.isArray(dataSet[key]) && dataSet[key].length === 0) ||
                (dataSet[key]?.calledBy && dataSet[key].calledBy.length === 0)) {
                delete dataSet[key];
            }
        }
    }

    // 存储所有现存文件路径
    const allExistingFiles = new Set();
    // 目录遍历函数
    async function walk(currentDir) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (['.c', '.h'].includes(path.extname(fullPath))) {
                const relativePath = path.relative(await getProjectPath(), fullPath);
                allExistingFiles.add(relativePath); // 记录所有现存文件

                const stats = await fs.stat(fullPath);
                if (forceRescan || stats.mtimeMs > lastScanTime) {
                    await processFile(fullPath);
                }
            }
        }
    }

    // 执行扫描
    await walk(dir);

    // 清理已删除文件的数据
    if (!forceRescan) {
        cleanupDeletedFiles(functionDefinitions, allExistingFiles);
        cleanupDeletedFiles(functionCalls, allExistingFiles);
    }

    // 保存结果
    await fs.writeFile(
        path.join(dbPath, functionDefinitionsFile),
        JSON.stringify(functionDefinitions, null, 2)
    );
    await fs.writeFile(
        path.join(dbPath, functionCallsFile),
        JSON.stringify(functionCalls, null, 2)
    );

    // 更新时间戳
    await fs.writeFile(
        path.join(dbPath, lastScanTimestampFile),
        JSON.stringify({ lastScanTime: Date.now() }, null, 2)
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