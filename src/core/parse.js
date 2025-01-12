const fs = require('fs').promises;
const path = require('path');
const Parser = require('tree-sitter');
const CParser = require('tree-sitter-c');
const { getProjectPath, getProjectDatabasePath } = require('./project');
const { print } = require('../util/log');

// 初始化 Tree-Sitter 解析器
const parser = new Parser();
parser.setLanguage(CParser);

// 存储文件路径和文件名
const lastScanTimestampFile = 'last_scan_timestamp.json';
const functionDefinitionsFile = 'function_definitions.json';
const functionCallsFile = 'function_calls.json';

// 存储函数定义和调用关系的数据结构
let functionDefinitions = {};
let functionCalls = {};

/**
 * 读取上次扫描时间戳
 * @returns 上次扫描时间戳
 */
async function readLastScanTimestamp() {
    try {
        const projectDatabasePath = await getProjectDatabasePath();
        const data = await fs.readFile(path.join(projectDatabasePath, lastScanTimestampFile), 'utf8');
        return JSON.parse(data).timestamp;
    } catch (err) {
        // 如果文件不存在或读取失败，返回一个非常早的时间戳
        return 0;
    }
}

/**
 * 写入上次扫描时间戳
 * @param {number} timestamp
 */
async function writeLastScanTimestamp(timestamp) {
    try {
        const projectDatabasePath = await getProjectDatabasePath();
        await fs.writeFile(path.join(projectDatabasePath, lastScanTimestampFile), JSON.stringify({ timestamp }), 'utf8');
    } catch (err) {
        print('error', 'Error writing last scan timestamp');
        print('error', err);
    }
}

/**
 * 加载现有的函数定义和调用关系
 */
async function loadExistingData() {
    try {
        const projectDatabasePath = await getProjectDatabasePath();
        const definitionsData = await fs.readFile(path.join(projectDatabasePath, functionDefinitionsFile), 'utf8');
        const callsData = await fs.readFile(path.join(projectDatabasePath, functionCallsFile), 'utf8');
        Object.assign(functionDefinitions, JSON.parse(definitionsData));
        Object.assign(functionCalls, JSON.parse(callsData));
    } catch (err) {
        print('error', 'Error reading existing data');
        print('error', err);
    }
}

/**
 * 清空现有的函数定义和调用关系
 */
async function resetExistingData() {
    functionDefinitions = {};
    functionCalls = {};

    // 如果文件存在，删除文件
    const projectDatabasePath = await getProjectDatabasePath();
    const files = [functionDefinitionsFile, functionCallsFile];
    for (const file of files) {
        const filePath = path.join(projectDatabasePath, file);
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                print('error', `Error deleting file ${filePath}`);
                print('error', err);
            }
        }
    }

    // 写入一个空对象到文件
    await outputFunctionDefinitionsToFile(path.join(projectDatabasePath, functionDefinitionsFile));
    await outputFunctionCallsToFile(path.join(projectDatabasePath, functionCallsFile));
}

/**
 * 遍历目录，解析文件，并输出函数定义和调用关系到文件
 * @param {string} dir 目录路径
 * @param {boolean} forceRescan 是否强制重新扫描
 * @param {boolean} isRecursion 是否递归调用
 */
async function traverseDirectory(dir, forceRescan = false, isRecursion = false) {
    try {
        const lastScanTimestamp = await readLastScanTimestamp();
        const files = await fs.readdir(dir);
        let hasUpdatedFiles = false;

        // 如果强制重新扫描，只在第一次调用时清空数据
        if (forceRescan && !isRecursion) {
            await resetExistingData();
        } else {
            // 加载现有的函数定义和调用关系
            await loadExistingData();
        }

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                const subDirUpdated = await traverseDirectory(filePath, forceRescan, true);
                if (subDirUpdated) {
                    hasUpdatedFiles = true;
                }
            } else if (filePath.endsWith('.c') || filePath.endsWith('.h')) {
                print('debug', `Checking file: ${filePath}`);
                if (forceRescan || stats.mtimeMs > lastScanTimestamp) {
                    print('debug', `Parsing file: ${filePath}`);
                    await parseFile(filePath);
                    hasUpdatedFiles = true;
                }
            }
        }

        if (hasUpdatedFiles) {
            // 输出函数定义和调用关系到文件
            const projectDatabasePath = await getProjectDatabasePath();
            await outputFunctionDefinitionsToFile(path.join(projectDatabasePath, functionDefinitionsFile));
            await outputFunctionCallsToFile(path.join(projectDatabasePath, functionCallsFile));

            // 写入上次扫描时间戳
            await writeLastScanTimestamp(Date.now());
        }

        return hasUpdatedFiles;
    } catch (err) {
        print('error', `Error reading directory ${dir}`);
        print('error', err);
        return false;
    }
}

/**
 * 解析单个文件
 * @param {string} filePath 文件路径
 */
async function parseFile(filePath) {
    try {
        // 清空该文件相关的函数定义和调用信息
        const relativeFilePath = path.relative(getProjectPath(), filePath);
        functionDefinitions = Object.fromEntries(
            Object.entries(functionDefinitions).filter(([_, definitions]) =>
                !definitions.some(def => def.filePath === relativeFilePath)
            )
        );
        functionCalls = Object.fromEntries(
            Object.entries(functionCalls).filter(([_, calls]) =>
                !calls.calledBy.some(call => call.filePath === relativeFilePath)
            )
        );

        const code = await fs.readFile(filePath, 'utf8');
        const tree = parser.parse(code);
        const root = tree.rootNode;

        // 提取函数定义和调用信息
        extractFunctionDefinitions(root, filePath);
        extractFunctionCalls(root, filePath);
    } catch (err) {
        print('error', `Error parsing file ${filePath}`);
        print('error', err);
    }
}

/**
 * 从声明器中提取函数名称
 * @param {object} declarator 声明器节点
*/
function findFunctionNameInDeclarator(declarator) {
    // 使用递归查找最内层的 identifier 节点
    function traverse(node) {
        if (node.type === 'identifier') {
            return node.text;
        }

        for (const child of node.children) {
            const result = traverse(child);
            if (result) {
                return result;
            }
        }

        return null;
    }

    const functionName = traverse(declarator);
    if (!functionName) {
        print('debug', `No identifier found in declarator: ${declarator.toString()}`);
    }

    return functionName;
}

/**
 * 提取函数定义和调用信息
 * @param {object} node 语法树节点
 * @param {string} filePath 文件路径
 */
function extractFunctionDefinitions(node, filePath) {
    const projectPath = getProjectPath();
    for (const child of node.children) {
        if (child.type === 'function_definition') {
            const declarator = child.childForFieldName('declarator');
            let functionName = '';

            if (declarator) {
                functionName = findFunctionNameInDeclarator(declarator);
            } else {
                print('debug', `Unexpected declarator type: ${declarator ? declarator.type : 'null'} in file: ${filePath}`);
            }

            if (functionName) {
                if (!functionDefinitions[functionName]) {
                    functionDefinitions[functionName] = [];
                }

                const definitionInfo = {
                    filePath: path.relative(projectPath, filePath),
                    lineNumber: child.startPosition.row + 1
                };

                // 检查是否已经存在相同的定义
                const existingDefinition = functionDefinitions[functionName].find(
                    d => d.filePath === definitionInfo.filePath &&
                        d.lineNumber === definitionInfo.lineNumber
                );

                if (!existingDefinition) {
                    functionDefinitions[functionName].push(definitionInfo);
                    print('debug', `Found function definition: ${functionName} at ${filePath}:${child.startPosition.row + 1}`);
                }
            } else {
                print('debug', `Failed to extract function name from declarator in file: ${filePath}`);
            }
        }
        extractFunctionDefinitions(child, filePath);
    };
}

/**
 * 提取函数调用信息
 * @param {object} node 语法树节点
 * @param {string} filePath 文件路径
 * @param {string} callerFunctionName 调用函数的名称
 */
function extractFunctionCalls(node, filePath, callerFunctionName = '') {
    const projectPath = getProjectPath();

    for (const child of node.children) {
        if (child.type === 'function_definition') {
            const declarator = child.childForFieldName('declarator');
            let functionName = '';

            if (declarator) {
                functionName = findFunctionNameInDeclarator(declarator);
            } else {
                print('debug', `Unexpected declarator type: ${declarator ? declarator.type : 'null'} in file: ${filePath}`);
            }

            if (functionName) {
                print('debug', `Entering function: ${functionName} at ${filePath}:${child.startPosition.row + 1}`);
                extractFunctionCalls(child, filePath, functionName);
            }
        } else if (child.type === 'call_expression') {
            const functionIdentifier = child.firstNamedChild; // 获取第一个命名子节点
            if (functionIdentifier && functionIdentifier.type === 'identifier') {
                const functionName = functionIdentifier.text;
                if (!functionCalls[functionName]) {
                    functionCalls[functionName] = { calledBy: [] };
                }
                const callInfo = {
                    caller: callerFunctionName,
                    filePath: path.relative(projectPath, filePath),
                    lineNumber: child.startPosition.row + 1
                };

                // 检查是否已经存在相同的调用
                const existingCall = functionCalls[functionName].calledBy.find(
                    c => c.caller === callInfo.caller &&
                        c.filePath === callInfo.filePath &&
                        c.lineNumber === callInfo.lineNumber
                );

                if (!existingCall) {
                    functionCalls[functionName].calledBy.push(callInfo);
                    print('debug', `Function call found: ${functionName} in ${callerFunctionName} at ${filePath}:${child.startPosition.row + 1}`);
                }
            } else {
                print('debug', `Unexpected call expression structure: ${child.toString()}`); // 打印未识别的 call_expression 结构
            }
        } else {
            extractFunctionCalls(child, filePath, callerFunctionName);
        }
    };
}

/**
 * 输出函数定义关系到文件
 * @param {string} outputFilePath 输出文件路径
 */
async function outputFunctionDefinitionsToFile(outputFilePath) {
    try {
        const data = JSON.stringify(functionDefinitions, null, 2);
        await fs.writeFile(outputFilePath, data, 'utf8');
        print('info', `Function definitions have been written to ${outputFilePath}`);
    } catch (err) {
        print('error', `Error writing to file ${outputFilePath}`);
        print('error', err);
    }
}

/**
 * 输出函数调用关系到文件
 * @param {string} outputFilePath 输出文件路径
 */
async function outputFunctionCallsToFile(outputFilePath) {
    try {
        const data = JSON.stringify(functionCalls, null, 2);
        await fs.writeFile(outputFilePath, data, 'utf8');
        print('info', `Function calls have been written to ${outputFilePath}`);
    } catch (err) {
        print('error', `Error writing to file ${outputFilePath}`);
        print('error', err);
    }
}

/**
 * 从文件中读取函数定义关系到对象
 * @param {string} inputFilePath 输入文件路径
 * @returns 函数定义关系对象
 */
async function readFunctionDefinitionsFromFile(inputFilePath) {
    try {
        const data = await fs.readFile(inputFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        print('error', `Error reading function definitions from file ${inputFilePath}`);
        print('error', err);
        return {};
    }
}

/**
 * 从文件中读取函数调用关系到对象
 * @param {string} inputFilePath 输入文件路径
 * @returns 函数调用关系对象
 */
async function readFunctionCallsFromFile(inputFilePath) {
    try {
        const data = await fs.readFile(inputFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        print('error', `Error reading function calls from file ${inputFilePath}`);
        print('error', err);
        return {};
    }
}

/**
 * 查询函数定义
 * @param {string} functionName 函数名称
 * @returns 函数定义信息
 */
async function getFunctionDefinition(functionName) {
    const projectDatabasePath = await getProjectDatabasePath();
    const functionDefinitions = await readFunctionDefinitionsFromFile(path.join(projectDatabasePath, functionDefinitionsFile));
    return functionDefinitions[functionName] || [];
}

/**
 * 查询函数调用
 * @param {string} functionName 函数名称
 * @returns 函数调用信息
 */
async function getFunctionCalls(functionName) {
    const projectDatabasePath = await getProjectDatabasePath();
    const functionCalls = await readFunctionCallsFromFile(path.join(projectDatabasePath, functionCallsFile));

    const result = {};
    result[functionName] = functionCalls[functionName] || { calledBy: [] };

    return result;
}

module.exports = {
    traverseDirectory,
    getFunctionDefinition,
    getFunctionCalls
};
