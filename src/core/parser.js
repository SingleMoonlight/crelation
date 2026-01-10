const fs = require('fs').promises;
const path = require('path');
const Parser = require('tree-sitter');
const CParser = require('tree-sitter-c');
const { print } = require('../frame/channel');
const { ErrorHandler, ErrorCodes } = require('./error');

/**
 * 解析器管理类 - 封装Tree-sitter解析逻辑
 */
class ParserManager {
    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(CParser);
        this.supportedExtensions = ['.c', '.h'];
    }

    /**
     * 检查文件是否支持解析
     * @param {string} filePath 文件路径
     * @returns {boolean}
     */
    isSupported(filePath) {
        const ext = path.extname(filePath);
        return this.supportedExtensions.includes(ext);
    }

    /**
     * 解析单个文件
     * @param {string} filePath 文件路径
     * @returns {Promise<Object>} 包含函数定义和调用关系的对象
     */
    async parseFile(filePath) {
        try {
            print('debug', `Parsing file: ${filePath}`);
            
            const code = await fs.readFile(filePath, 'utf-8');
            const tree = this.parser.parse(code);
            
            const result = {
                functionDefinitions: [],
                functionCalls: []
            };

            // 使用迭代方式遍历AST
            this.traverseAST(tree.rootNode, result);

            print('debug', `Parsed file: ${filePath}, functions: ${result.functionDefinitions.length}, calls: ${result.functionCalls.length}`);
            
            return result;
        } catch (error) {
            throw ErrorHandler.create(
                ErrorCodes.PARSE_ERROR,
                `Failed to parse file: ${filePath}`,
                { filePath, error: error.message }
            );
        }
    }

    /**
     * 遍历AST并提取函数信息
     * @param {Object} rootNode AST根节点
     * @param {Object} result 结果对象
     */
    traverseAST(rootNode, result) {
        const functionStack = [];
        const stack = [rootNode];

        while (stack.length > 0) {
            const node = stack.pop();

            if (node === 'EXIT_FUNCTION') {
                // 退出函数作用域
                if (functionStack.length > 0) {
                    functionStack.pop();
                }
                continue;
            }

            // 处理函数定义
            if (node.type === 'function_definition') {
                const functionInfo = this.extractFunctionDefinition(node);
                if (functionInfo) {
                    result.functionDefinitions.push(functionInfo);
                    functionStack.push(functionInfo.name);
                    stack.push('EXIT_FUNCTION');
                }
            }

            // 处理函数调用
            if (node.type === 'call_expression') {
                const callInfo = this.extractFunctionCall(node, functionStack);
                if (callInfo) {
                    result.functionCalls.push(callInfo);
                }
            }

            // 将子节点压入栈（逆序）
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }
    }

    /**
     * 提取函数定义信息
     * @param {Object} node AST节点
     * @returns {Object|null} 函数定义信息
     */
    extractFunctionDefinition(node) {
        const declarator = node.childForFieldName('declarator');
        const functionName = this.findFunctionName(declarator);

        if (functionName) {
            return {
                name: functionName,
                lineNumber: node.startPosition.row + 1,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1
            };
        }

        return null;
    }

    /**
     * 提取函数调用信息
     * @param {Object} node AST节点
     * @param {Array} functionStack 当前函数栈
     * @returns {Object|null} 函数调用信息
     */
    extractFunctionCall(node, functionStack) {
        const functionNode = node.childForFieldName('function');
        
        if (functionNode?.type === 'identifier') {
            const calleeName = functionNode.text;
            const callerName = functionStack[functionStack.length - 1] || 'global';

            return {
                callee: calleeName,
                caller: callerName,
                lineNumber: node.startPosition.row + 1
            };
        }

        return null;
    }

    /**
     * 查找函数名
     * @param {Object} node AST节点
     * @returns {string|null} 函数名
     */
    findFunctionName(node) {
        if (!node) return null;

        // 深度优先搜索identifier
        if (node.type === 'identifier') {
            return node.text;
        }

        for (const child of node.children) {
            const result = this.findFunctionName(child);
            if (result) return result;
        }

        return null;
    }

    /**
     * 批量解析文件
     * @param {Array<string>} filePaths 文件路径数组
     * @param {Function} progressCallback 进度回调函数
     * @returns {Promise<Array>} 解析结果数组
     */
    async parseFiles(filePaths, progressCallback = null) {
        const results = [];
        const total = filePaths.length;

        for (let i = 0; i < filePaths.length; i++) {
            try {
                const result = await this.parseFile(filePaths[i]);
                results.push({
                    filePath: filePaths[i],
                    success: true,
                    data: result
                });

                if (progressCallback) {
                    progressCallback(i + 1, total, filePaths[i]);
                }
            } catch (error) {
                print('warning', `Failed to parse ${filePaths[i]}:`, error);
                results.push({
                    filePath: filePaths[i],
                    success: false,
                    error: error.message
                });

                if (progressCallback) {
                    progressCallback(i + 1, total, filePaths[i]);
                }
            }
        }

        return results;
    }

    /**
     * 获取支持的文件扩展名
     * @returns {Array<string>}
     */
    getSupportedExtensions() {
        return [...this.supportedExtensions];
    }

    /**
     * 验证语法
     * @param {string} code 代码字符串
     * @returns {Object} 验证结果
     */
    validateSyntax(code) {
        try {
            const tree = this.parser.parse(code);
            const hasError = tree.rootNode.hasError();
            
            return {
                valid: !hasError,
                tree: tree,
                errors: hasError ? this.collectSyntaxErrors(tree.rootNode) : []
            };
        } catch (error) {
            return {
                valid: false,
                tree: null,
                errors: [error.message]
            };
        }
    }

    /**
     * 收集语法错误
     * @param {Object} node AST节点
     * @returns {Array} 错误列表
     */
    collectSyntaxErrors(node) {
        const errors = [];
        const stack = [node];

        while (stack.length > 0) {
            const current = stack.pop();

            if (current.type === 'ERROR' || current.isMissing()) {
                errors.push({
                    type: current.type,
                    line: current.startPosition.row + 1,
                    column: current.startPosition.column + 1,
                    text: current.text
                });
            }

            for (const child of current.children) {
                stack.push(child);
            }
        }

        return errors;
    }
}

// 单例模式
let instance = null;

/**
 * 获取解析器管理器实例
 * @returns {ParserManager}
 */
function getParserManager() {
    if (!instance) {
        instance = new ParserManager();
    }
    return instance;
}

module.exports = {
    ParserManager,
    getParserManager
};
