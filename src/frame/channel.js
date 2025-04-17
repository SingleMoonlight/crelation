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
    const config = vscode.workspace.getConfiguration('crelation');
    const settingLogLevel = config.get('logLevel').toUpperCase();

    if (logLevels[settingLogLevel]?.level < logLevel.level) {
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

module.exports = { 
    initOutputChannel,
    destroyOutputChannel,
    print
}; 
