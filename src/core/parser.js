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
        // 使用单个 TreeCursor 做迭代式 DFS，避免为每个节点构造 JS 节点对象。
        // tree-sitter 0.22.x 的 node.children 会经共享 transfer buffer 逐节点
        // 编组并查树级节点缓存，遍历大型 flat 节点（如数千元素的数组初始化表）
        // 时退化到数万毫秒；cursor 方式遍历同样的树只需数毫秒。
        const cursor = rootNode.walk();
        // 子树嵌套标记：进入一棵子树（有子节点）时入栈，记录该子树根是否
        // function_definition；离开子树时出栈并据此恢复 functionStack。
        const fdefMarkers = [];

        while (true) {
            const nodeType = cursor.nodeType;

            // 跳过预处理指令（例如 #define），避免大量宏导致遍历性能下降
            const isPreproc = nodeType.startsWith('preproc');
            let isFunctionDefinition = false;
            let descended = false;

            if (!isPreproc) {
                // 处理函数定义
                if (nodeType === 'function_definition') {
                    // currentNode 仅在函数定义节点处构造，数量远少于总节点数
                    const functionInfo = this.extractFunctionDefinition(cursor.currentNode);
                    if (functionInfo) {
                        result.functionDefinitions.push(functionInfo);
                        functionStack.push(functionInfo.name);
                        isFunctionDefinition = true;
                    }
                }

                // 处理函数调用
                if (nodeType === 'call_expression') {
                    const callInfo = this.extractFunctionCall(cursor.currentNode, functionStack);
                    if (callInfo) {
                        result.functionCalls.push(callInfo);
                    }
                }

                descended = cursor.gotoFirstChild();
            }

            if (descended) {
                fdefMarkers.push(isFunctionDefinition);
                continue;
            }

            // 叶子节点（或被跳过的预处理节点）无子树，直接寻找下一个待处理节点
            while (true) {
                if (cursor.gotoNextSibling()) {
                    break;
                }
                if (!cursor.gotoParent()) {
                    return;
                }
                // 离开一棵子树：若该子树根是 function_definition 则退出其函数作用域
                if (fdefMarkers.pop()) {
                    functionStack.pop();
                }
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
