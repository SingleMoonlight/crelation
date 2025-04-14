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
 * @param {string|Error} message 日志内容
 */
function print(type, message) {
    const logLevel = logLevels[type.toUpperCase()];
    const config = vscode.workspace.getConfiguration('crelation');
    const settingLogLevel = config.get('logLevel').toUpperCase();

    if (logLevels[settingLogLevel] && logLevels[settingLogLevel].level < logLevel.level) {
        return;
    }

    let errorMessage = message;

    if (message instanceof Error) {
        errorMessage = `${message.name}: ${message.message}\nStack: ${message.stack}`;
    }

    if (logLevel && logLevel.log) {
        logLevel.log(errorMessage);
    } else {
        outputChannel.info(errorMessage);
    }
}

module.exports = { 
    initOutputChannel,
    destroyOutputChannel,
    print
}; 
