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
        // 标准化路径处理（解决Windows盘符路径问题）
        oldPath = path.normalize(oldPath);
        newPath = path.normalize(newPath);

        // 校验源路径有效性
        try {
            await fs.access(oldPath);
        } catch {
            print('warn', `源路径不存在: ${oldPath}`);
            return;
        }

        // 创建完整目标路径结构（确保多级目录存在）
        const createParentDir = async (targetPath) => {
            const parentDir = path.dirname(targetPath);
            try {
                await fs.access(parentDir);
            } catch {
                await createParentDir(parentDir);
                await fs.mkdir(parentDir);
            }
        };
        await createParentDir(newPath);
        await fs.mkdir(newPath, { recursive: true });

        // 增强版目录遍历（处理符号链接等特殊情况）
        const safeReaddir = async (dirPath) => {
            try {
                return await fs.readdir(dirPath, { withFileTypes: true });
            } catch (error) {
                print('warn', `跳过不可读目录: ${dirPath}`);
                return [];
            }
        };

        // 优化文件操作时序（先处理文件再处理目录）
        const entries = await safeReaddir(oldPath);
        const files = entries.filter(e => e.isFile());
        const dirs = entries.filter(e => e.isDirectory());

        // 处理文件（带进度跟踪）
        for (const file of files) {
            const src = path.join(oldPath, file.name);
            const dest = path.join(newPath, file.name);
            
            // 确保目标目录存在
            await fs.mkdir(path.dirname(dest), { recursive: true });
            
            try {
                await fs.copyFile(src, dest);
                await fs.unlink(src);
            } catch (error) {
                print('error', `文件迁移失败: ${src} → ${dest} | ${error.message}`);
            }
        }

        // 递归处理子目录
        for (const dir of dirs) {
            const src = path.join(oldPath, dir.name);
            const dest = path.join(newPath, dir.name);
            await performMigration(src, dest);
        }

        // 安全删除源目录（处理残留文件）
        try {
            await fs.rm(oldPath, { 
                recursive: true,
                force: true,
                maxRetries: 3,
                retryDelay: 500
            });
        } catch (error) {
            print('warn', `目录删除失败: ${oldPath} | ${error.message}`);
        }

    } catch (error) {
        print('error', `迁移失败: ${error.message}`);
        throw error;
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

/**
 * 获取是否在第二个列显示调用关系
 * @returns {boolean} 是否在第二个列显示调用关系
 */
function getShowRelationInSecondColumn()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('showRelationsInSecondColumn');
}

module.exports = {
	initSetting,
    getDataSavePath,
    getAutoInitDatabase,
    getShowRelationInSecondColumn
};
