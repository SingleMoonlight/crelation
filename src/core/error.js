const { print } = require('../frame/channel');
const { showErrorMessage, showWarningMessage } = require('../frame/message');

/**
 * 错误详情，按需附带上下文，例如 { filePath }
 * @typedef {Record<string, any>} ErrorDetails
 */

/**
 * 自定义错误类型
 */
class CRelationError extends Error {
    /**
     * @param {string} message 错误消息
     * @param {string} code 错误代码
     * @param {ErrorDetails | null} details 详细信息
     */
    constructor(message, code, details = null) {
        super(message);
        this.name = 'CRelationError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    /**
     * 格式化错误信息
     */
    format() {
        let msg = `[${this.code}] ${this.message}`;
        if (this.details) {
            msg += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
        }
        return msg;
    }
}

/**
 * 错误代码定义
 */
const ErrorCodes = {
    // 文件系统错误 (1xxx)
    FILE_NOT_FOUND: 'ERR_1001',
    FILE_READ_ERROR: 'ERR_1002',
    FILE_WRITE_ERROR: 'ERR_1003',
    DIRECTORY_ACCESS_ERROR: 'ERR_1004',

    // 解析错误 (2xxx)
    PARSE_ERROR: 'ERR_2001',
    INVALID_SYNTAX: 'ERR_2002',
    TREE_SITTER_ERROR: 'ERR_2003',

    // 数据库错误 (3xxx)
    DATABASE_INIT_ERROR: 'ERR_3001',
    DATABASE_LOAD_ERROR: 'ERR_3002',
    DATABASE_SAVE_ERROR: 'ERR_3003',
    DATA_CORRUPTION: 'ERR_3004',

    // 项目错误 (4xxx)
    NO_PROJECT_OPEN: 'ERR_4001',
    PROJECT_PATH_INVALID: 'ERR_4002',
    PROJECT_NOT_INITIALIZED: 'ERR_4003',

    // 配置错误 (5xxx)
    CONFIG_INVALID: 'ERR_5001',
    CONFIG_MIGRATION_ERROR: 'ERR_5002',

    // 运行时错误 (6xxx)
    MEMORY_ERROR: 'ERR_6001',
    TIMEOUT_ERROR: 'ERR_6002',
    UNKNOWN_ERROR: 'ERR_6999'
};

/**
 * 错误处理选项
 * @typedef {Object} ErrorHandlingOptions
 * @property {Object} [context] 上下文信息
 * @property {boolean} [showToUser] 是否向用户显示错误
 * @property {any} [defaultValue] 出错时返回的默认值
 * @property {number} [timeout] 超时毫秒数，0 表示不限时
 * @property {boolean} [continueOnError] 批量执行时出错是否继续
 */

/**
 * 批量执行结果
 * @typedef {Object} BatchResult
 * @property {Array<{ name: string, result: any }>} successful 成功的操作
 * @property {Array<{ name: string, error: unknown }>} failed 失败的操作
 * @property {number} total 操作总数
 */

/**
 * 错误处理器
 */
class ErrorHandler {
    /**
     * 处理错误
     * @param {unknown} error 错误对象，catch 捕获到的值类型未知
     * @param {Object} context 上下文信息
     * @param {boolean} showToUser 是否向用户显示错误
     */
    static handle(error, context = {}, showToUser = true) {
        // 统一成 Error，避免下游到处做类型判断
        const err = error instanceof Error ? error : new Error(String(error));

        // 记录错误
        const errorInfo = {
            message: err.message,
            code: err instanceof CRelationError ? err.code : ErrorCodes.UNKNOWN_ERROR,
            stack: err.stack,
            context: context,
            timestamp: new Date().toISOString()
        };

        print('error', 'Error occurred:', errorInfo);

        // 根据错误类型决定是否向用户显示
        if (showToUser) {
            this.showUserMessage(err);
        }

        // 返回格式化的错误信息
        return errorInfo;
    }

    /**
     * 向用户显示错误消息
     * @param {Error} error 错误对象
     */
    static showUserMessage(error) {
        let userMessage = this.getUserFriendlyMessage(error);
        
        if (error instanceof CRelationError) {
            // 根据错误代码决定严重程度
            if (error.code.startsWith('ERR_4') || error.code.startsWith('ERR_5')) {
                showWarningMessage(userMessage);
            } else {
                showErrorMessage(userMessage);
            }
        } else {
            showErrorMessage(userMessage);
        }
    }

    /**
     * 获取用户友好的错误消息
     * @param {Error} error 错误对象
     * @returns {string}
     */
    static getUserFriendlyMessage(error) {
        if (error instanceof CRelationError) {
            switch (error.code) {
                case ErrorCodes.NO_PROJECT_OPEN:
                    return 'No project is currently open. Please open a project first.';
                case ErrorCodes.FILE_NOT_FOUND:
                    return `File not found: ${error.details?.filePath || 'unknown'}`;
                case ErrorCodes.DATABASE_INIT_ERROR:
                    return 'Failed to initialize database. Please try again or check the logs.';
                case ErrorCodes.DATABASE_LOAD_ERROR:
                    return 'Failed to load database. The database may be corrupted.';
                case ErrorCodes.PARSE_ERROR:
                    return `Failed to parse file: ${error.details?.filePath || 'unknown'}`;
                case ErrorCodes.CONFIG_INVALID:
                    return 'Invalid configuration. Please check your settings.';
                default:
                    return `An error occurred: ${error.message}`;
            }
        }
        
        // 对于标准错误，提供通用消息
        return `Operation failed: ${error.message}`;
    }

    /**
     * 包装异步函数，自动处理错误
     * @param {(...args: any[]) => any} fn 要包装的函数
     * @param {ErrorHandlingOptions} [options] 选项
     * @returns {(this: any, ...args: any[]) => Promise<any>}
     */
    static wrapAsync(fn, options = {}) {
        const { context = {}, showToUser = true, defaultValue = null } = options;

        return async function (...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                ErrorHandler.handle(error, context, showToUser);
                return defaultValue;
            }
        };
    }

    /**
     * 创建特定类型的错误
     * @param {string} code 错误代码
     * @param {string} message 错误消息
     * @param {ErrorDetails | null} [details] 详细信息
     * @returns {CRelationError}
     */
    static create(code, message, details = null) {
        return new CRelationError(message, code, details);
    }

    /**
     * 验证并处理操作结果
     * @param {() => Promise<any>} operation 要执行的操作
     * @param {string} operationName 操作名称
     * @param {ErrorHandlingOptions} [options] 选项
     * @returns {Promise<any>}
     */
    static async executeWithErrorHandling(operation, operationName, options = {}) {
        const { showToUser = true, defaultValue = null, timeout = 0 } = options;
        
        try {
            print('debug', `Executing operation: ${operationName}`);
            
            let result;
            if (timeout > 0) {
                // 带超时的执行
                result = await Promise.race([
                    operation(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(
                            this.create(ErrorCodes.TIMEOUT_ERROR, `Operation timeout: ${operationName}`)
                        ), timeout)
                    )
                ]);
            } else {
                result = await operation();
            }
            
            print('debug', `Operation completed: ${operationName}`);
            return result;
        } catch (error) {
            print('error', `Operation failed: ${operationName}`, error);
            this.handle(error, { operation: operationName }, showToUser);
            return defaultValue;
        }
    }

    /**
     * 批量执行操作，收集错误
     * @param {Array<{ fn: () => Promise<any>, name: string }>} operations 操作数组 [{fn, name}]
     * @param {ErrorHandlingOptions} [options] 选项
     * @returns {Promise<BatchResult>}
     */
    static async executeBatch(operations, options = {}) {
        const { continueOnError = true, showToUser = false } = options;
        /** @type {BatchResult} */
        const results = {
            successful: [],
            failed: [],
            total: operations.length
        };

        for (const op of operations) {
            try {
                const result = await op.fn();
                results.successful.push({
                    name: op.name,
                    result: result
                });
            } catch (error) {
                results.failed.push({
                    name: op.name,
                    error: error
                });
                
                this.handle(error, { operation: op.name }, showToUser);
                
                if (!continueOnError) {
                    break;
                }
            }
        }

        print('info', `Batch execution completed: ${results.successful.length}/${results.total} successful`);
        return results;
    }
}

module.exports = {
    CRelationError,
    ErrorCodes,
    ErrorHandler
};
