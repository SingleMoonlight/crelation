const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

/**
 * 初始化设置
 */
function initSetting()
{
    const config = vscode.workspace.getConfiguration('crelation');
    const dataSavePathKey = 'dataSavePath';
    const defaultDataSavePath = path.join(os.homedir(), '.crelation');

    // 如果用户没有设置路径，则设置默认路径
    if (config.get(dataSavePathKey) === undefined || config.get(dataSavePathKey) === '') {
        config.update(dataSavePathKey, defaultDataSavePath, true);
        // 创建文件夹
        fs.mkdir(defaultDataSavePath, { recursive: true });
    } else {
        // 检查路径是否存在，如果不存在则创建
        const dataSavePath = config.get(dataSavePathKey);
        fs.access(dataSavePath).catch(() => {
            fs.mkdir(dataSavePath, { recursive: true });
        });
    }
}

/**
 * 获取数据保存路径
 * @returns {string} 数据保存路径
 */
function getDataSavePath()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('dataSavePath');
}

/**
 * 获取日志级别
 * @returns {string} 日志级别
 */
function getLogLevel()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('logLevel');
}

module.exports = {
	initSetting,
    getDataSavePath,
    getLogLevel
};
