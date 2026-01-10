const vscode = require('vscode');

let outputChannel;
let logLevels;

/**
 * 创建OutputChannel
 */
function initOutputChannel() {
    outputChannel = vscode.window.createOutputChannel('C Relation', { log: true });
    logLevels = {
        DEBUG: { level:4, log: outputChannel.debug },
        INFO: { level:3, log: outputChannel.info },
        WARN: { level:2, log: outputChannel.warn },
        ERROR: { level:1, log: outputChannel.error },
        OFF: { level:0, log: null },
    };
}

/**
 * 销毁OutputChannel
 */
function destroyOutputChannel() {
    outputChannel.dispose();
}

/**
 * 打印日志
 * @param {string} type 日志类型
 * @param {...any} messages 日志内容（支持多个参数）
 */
function print(type, ...messages) {
    const logLevel = logLevels[type.toUpperCase()];
    if (!logLevel) {
        console.error(`Invalid log type: ${type}`);
        return;
    }
    
    const config = vscode.workspace.getConfiguration('crelation');
    const settingLogLevel = (config.get('logLevel') || 'error').toUpperCase();

    if (!logLevels[settingLogLevel] || logLevels[settingLogLevel].level < logLevel.level) {
        return;
    }

    const processed = messages.map(msg => {
        if (msg instanceof Error) {
            return `${msg.name}: ${msg.message}\n${msg.stack}`;
        }
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg, null, 2);
            } catch {
                return '[Circular Object]';
            }
        }
        return String(msg);
    });

    const finalMessage = processed.join(' ');

    if (logLevel?.log) {
        logLevel.log(finalMessage);
    } else {
        outputChannel.info(finalMessage);
    }
}

/**
 * 打印带时间戳的结构化日志
 * @param {string} type 日志类型
 * @param {string} message 日志消息
 * @param {Object} metadata 元数据
 */
function printStructured(type, message, metadata = {}) {
    const logLevel = logLevels[type.toUpperCase()];
    if (!logLevel) {
        console.error(`Invalid log type: ${type}`);
        return;
    }
    
    const config = vscode.workspace.getConfiguration('crelation');
    const settingLogLevel = (config.get('logLevel') || 'error').toUpperCase();

    if (!logLevels[settingLogLevel] || logLevels[settingLogLevel].level < logLevel.level) {
        return;
    }

    const timestamp = new Date().toISOString();
    const structured = {
        timestamp,
        level: type.toUpperCase(),
        message,
        ...metadata
    };

    const formattedMessage = `[${timestamp}] ${message} ${JSON.stringify(metadata)}`;

    if (logLevel?.log) {
        logLevel.log(formattedMessage);
    } else {
        outputChannel.info(formattedMessage);
    }
}

/**
 * 打印性能日志
 * @param {string} operation 操作名称
 * @param {number} duration 耗时（毫秒）
 * @param {Object} metadata 元数据
 */
function printPerformance(operation, duration, metadata = {}) {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const milliseconds = duration % 1000;

    const formattedDuration = `${minutes}m ${seconds.toString().padStart(2, '0')}s ${milliseconds.toString().padStart(3, '0')}ms`;

    printStructured('info', `Performance: ${operation}`, {
        duration: formattedDuration,
        durationMs: duration,
        ...metadata
    });
}

/**
 * 创建性能计时器
 * @param {string} operation 操作名称
 * @returns {Object} 计时器对象
 */
function createTimer(operation) {
    const startTime = Date.now();
    
    return {
        stop: (metadata = {}) => {
            const duration = Date.now() - startTime;
            printPerformance(operation, duration, metadata);
            return duration;
        },
        getDuration: () => {
            return Date.now() - startTime;
        }
    };
}

module.exports = { 
    initOutputChannel,
    destroyOutputChannel,
    print,
    printStructured,
    printPerformance,
    createTimer
}; 
