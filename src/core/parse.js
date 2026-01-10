const fs = require('fs').promises;
const path = require('path');
const { getProjectPath } = require('./project');
const { print } = require('../frame/channel');
const { getDatabaseManager } = require('./database');
const { getParserManager } = require('./parser');
const { ErrorHandler, ErrorCodes } = require('./error');

/**
 * 递归遍历目录并解析代码文件
 * @param {string} dir 要扫描的目录路径
 * @param {boolean} forceRescan 是否强制重新扫描
 * @param {Function} progressCallback 进度回调函数 (current, total, filename)
 */
async function traverseDirectory(dir, forceRescan = false, progressCallback = null) {
    const dbManager = getDatabaseManager();
    const parserManager = getParserManager();
    
    let functionDefinitions = {};
    let functionCalls = {};
    let lastScanTime = 0;

    // 加载已有数据和上次扫描时间戳
    if (!forceRescan) {
        try {
            functionDefinitions = await dbManager.getAllDefinitions();
            functionCalls = await dbManager.getAllCalls();
            lastScanTime = await dbManager.getLastScanTime();
        } catch(error) {
            // 文件不存在时强制全量扫描
            forceRescan = true;
            print('error', 'Failed to load existing database, performing full scan.', error);
        }
    }

    // 记录需要处理的文件列表
    const processedFiles = new Set();

    // 处理单个文件
    async function processFile(filePath) {
        const relativePath = path.relative(await getProjectPath(), filePath);
        processedFiles.add(relativePath);

        // 清除该文件的旧数据
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

        // 使用新的解析器解析文件
        try {
            const parseResult = await parserManager.parseFile(filePath);
            
            // 记录函数定义
            for (const funcDef of parseResult.functionDefinitions) {
                (functionDefinitions[funcDef.name] ||= []).push({
                    filePath: relativePath,
                    lineNumber: funcDef.lineNumber
                });
            }

            // 记录调用关系
            for (const funcCall of parseResult.functionCalls) {
                (functionCalls[funcCall.callee] ||= { calledBy: [] }).calledBy.push({
                    caller: funcCall.caller,
                    filePath: relativePath,
                    lineNumber: funcCall.lineNumber
                });
            }
        } catch (error) {
            print('warning', `Failed to parse file: ${filePath}`, error);
        }
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
    const filesToProcess = [];
    
    // 第一遍扫描：收集所有文件
    async function collectFiles(startDir) {
        const dirStack = [startDir];
        const visitedPaths = new Set();
        
        while (dirStack.length > 0) {
            const currentDir = dirStack.pop();
            
            try {
                const realPath = await fs.realpath(currentDir);
                
                if (visitedPaths.has(realPath)) {
                    continue;
                }
                
                visitedPaths.add(realPath);
                
                const entries = await fs.readdir(currentDir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    
                    if (entry.isDirectory()) {
                        dirStack.push(fullPath);
                    } else if (parserManager.isSupported(fullPath)) {
                        const relativePath = path.relative(await getProjectPath(), fullPath);
                        allExistingFiles.add(relativePath);

                        const stats = await fs.stat(fullPath);
                        if (forceRescan || stats.mtimeMs > lastScanTime) {
                            filesToProcess.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                print('warning', `Error processing directory ${currentDir}:`, error);
            }
        }
    }

    print('info', 'Starting function scan.');
    // 第一遍：收集文件
    await collectFiles(dir);
    
    const totalFiles = filesToProcess.length;
    print('info', `Found ${totalFiles} files to process.`);
    
    // 第二遍：处理文件并报告进度
    for (let i = 0; i < filesToProcess.length; i++) {
        await processFile(filesToProcess[i]);
        
        // 调用进度回调
        if (progressCallback) {
            const fileName = path.basename(filesToProcess[i]);
            progressCallback(i + 1, totalFiles, fileName);
        }
        
        // 每处理10个文件，让出控制权，避免阻塞UI线程
        if (i % 10 === 0) {
            await new Promise(resolve => setImmediate(resolve));
        }
    }

    print('info', 'Cleaning up deleted files.');
    // 清理已删除文件的数据
    if (!forceRescan) {
        cleanupDeletedFiles(functionDefinitions, allExistingFiles);
        cleanupDeletedFiles(functionCalls, allExistingFiles);
    }

    print('info', 'Saving results.');
    // 使用DatabaseManager保存结果
    await dbManager.saveAll(functionDefinitions, functionCalls);
}

/**
 * 查询函数定义信息
 * @param {string} functionName 要查询的函数名
 * @returns {Promise<Array>} 函数定义位置数组
 */
async function getFunctionDefinition(functionName) {
    const dbManager = getDatabaseManager();
    return await dbManager.getFunctionDefinitions(functionName);
}

/**
 * 查询函数调用关系
 * @param {string} functionName 要查询的函数名
 * @returns {Promise<Object>} 调用关系对象
 */
async function getFunctionCalls(functionName) {
    const dbManager = getDatabaseManager();
    return await dbManager.getFunctionCalls(functionName);
}

module.exports = {
    traverseDirectory,
    getFunctionDefinition,
    getFunctionCalls
};