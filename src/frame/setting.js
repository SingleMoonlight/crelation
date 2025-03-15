const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { print } = require('../util/log');

// global variable，数据保存路径以 globalState 为准，如果用户修改了路径，则在重启后更新和生效
let dataSavePath = '';

/**
 * 迁移数据
 * @param {string} oldPath 旧路径
 * @param {string} newPath 新路径
 */
async function performMigration(oldPath, newPath) {
    try {
        // 确保目标目录存在
        fs.mkdir(newPath, { recursive: true });

        // 读取源目录内容
        const entries = await fs.readdir(oldPath, { withFileTypes: true });

        // 遍历所有条目
        for (const entry of entries) {
            const srcPath = path.join(oldPath, entry.name);
            const destPath = path.join(newPath, entry.name);

            if (entry.isDirectory()) {
                // 递归处理子目录
                await performMigration(srcPath, destPath);
            } else {
                // 移动文件（跨设备安全方案）
                await fs.copyFile(srcPath, destPath);
                await fs.unlink(srcPath); // 删除原文件
            }
        }

        // 删除空目录
        await fs.rmdir(oldPath);
        
    } catch (error) {
        print('error', `Migration failed: ${error.message}`);
    }
}

/**
 * 初始化设置
 * @param {vscode.ExtensionContext} context
 */
function initSetting(context)
{
    const config = vscode.workspace.getConfiguration('crelation');
    const dataSavePathKey = 'dataSavePath';
    const defaultDataSavePath = path.join(os.homedir(), '.crelation');

    // 如果用户没有设置路径，则设置默认路径
    if (config.get(dataSavePathKey) === undefined || config.get(dataSavePathKey) === '') {
        config.update(dataSavePathKey, defaultDataSavePath, true);
        // 创建文件夹
        fs.mkdir(defaultDataSavePath, { recursive: true });
        // 记录路径到 globalState
        context.globalState.update('dataSavePath', defaultDataSavePath);
    } else {
        const settingDataSavePath = config.get(dataSavePathKey);
        // 如果路径与 globalState 不一致，则迁移数据
        const globalStateDataSavePath = context.globalState.get('dataSavePath');

        print('debug', `globalStateDataSavePath: ${globalStateDataSavePath}`);
        print('debug', `settingDataSavePath: ${settingDataSavePath}`);

        if (globalStateDataSavePath && globalStateDataSavePath !== settingDataSavePath) {
            performMigration(globalStateDataSavePath, settingDataSavePath);
        }
        // 记录路径到 globalState
        context.globalState.update('dataSavePath', settingDataSavePath);
    }

    dataSavePath = context.globalState.get('dataSavePath');
}

/**
 * 获取数据保存路径
 * @returns {string} 数据保存路径
 */
function getDataSavePath()
{
    // 数据路径以 globalState 为准
    return dataSavePath;
}

/**
 * 获取自动初始化数据库
 * @returns {boolean} 是否自动初始化数据库
 */
function getAutoInitDatabase()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('autoInitDatabase');
}

module.exports = {
	initSetting,
    getDataSavePath,
    getAutoInitDatabase,
};
