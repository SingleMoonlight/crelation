const { getLogLevel } = require('../frame/setting');

const COLORS = {
    RESET: '\x1b[0m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    WHITE: '\x1b[37m'
};

const LOG_LEVELS = {
    DEBUG: { level:4, color: COLORS.WHITE, label: 'DEBUG' },
    INFO: { level:3, color: COLORS.BLUE, label: 'INFO' },
    WARN: { level:2, color: COLORS.YELLOW, label: 'WARN' },
    ERROR: { level:1, color: COLORS.RED, label: 'ERROR' },
    OFF: { level:0, color: COLORS.RESET, label: 'OFF' },
};

/**
 * 打印日志
 * @param {string} type 日志类型
 * @param {string|Error} message 日志内容
 */
function print(type, message) {
    const logLevel = LOG_LEVELS[type.toUpperCase()];
    const settingLogLevel = getLogLevel().toUpperCase();

    if (LOG_LEVELS[settingLogLevel] && LOG_LEVELS[settingLogLevel].level < logLevel.level) {
        return;
    }

    let errorMessage = message;

    if (message instanceof Error) {
        errorMessage = `${message.name}: ${message.message}\nStack: ${message.stack}`;
    }

    if (logLevel) {
        console.log(`${logLevel.color}[${logLevel.label}] ${errorMessage}${COLORS.RESET}`);
    } else {
        console.log(`[UNKNOWN] ${errorMessage}`);
    }
}

module.exports = { print };
