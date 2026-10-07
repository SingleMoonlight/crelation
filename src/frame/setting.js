const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { print } = require('../frame/channel');
const { showWarningMessage } = require('../frame/message');

// global variable，数据保存路径以 globalState 为准，如果用户修改了路径，则在重启后更新和生效
let dataSavePath = '';

/**
 * 判断目标路径是否就是源路径本身、或位于源路径内部
 * @param {string} sourcePath 源目录
 * @param {string} targetPath 目标目录
 * @returns {boolean}
 */
function isSameOrInside(sourcePath, targetPath) {
    const relative = path.relative(path.resolve(sourcePath), path.resolve(targetPath));

    // 相对路径为空表示同一目录
    if (relative === '') {
        return true;
    }
    // 不在同一盘符时 path.relative 返回绝对路径
    if (path.isAbsolute(relative)) {
        return false;
    }
    // 以 .. 开头（且不是名为 ..xxx 的子目录）说明目标在源目录之外
    return relative !== '..' && !relative.startsWith('..' + path.sep);
}

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

        // 目标目录位于源目录内部时，下面的递归会扫描到自己刚创建出来的目录，从而无限递归下去直到耗尽内存，必须直接跳过
        if (isSameOrInside(oldPath, newPath)) {
            print('warn', `Skip migration: target "${newPath}" is the same as or inside source "${oldPath}".`);
            return;
        }

        // 校验源路径有效性
        try {
            await fs.access(oldPath);
        } catch(error) {
            print('warn', 'Source path', oldPath,  'does not exit.', error);
            return;
        }

        // 创建完整目标路径结构（确保多级目录存在）
        /**
         * @param {string} targetPath 目标路径
         */
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
        /**
         * @param {string} dirPath 目录路径
         */
        const safeReaddir = async (dirPath) => {
            try {
                return await fs.readdir(dirPath, { withFileTypes: true });
            } catch {
                print('warn', 'Skipping unreadable directory: ', dirPath);
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
            } catch {
                print('warn', 'File migration failed from ', src, 'to ', dest);
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
        } catch {
            print('warn', 'Directory deletion failed: ', oldPath);
        }

    } catch (error) {
        print('error', 'Migration failed.');
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
        
        // 验证路径
        if (!validateDataSavePath(settingDataSavePath)) {
            showWarningMessage(`Invalid data save path: ${settingDataSavePath}. Using default path.`);
            config.update(dataSavePathKey, defaultDataSavePath, true);
            fs.mkdir(defaultDataSavePath, { recursive: true });
            context.globalState.update('dataSavePath', defaultDataSavePath);
            dataSavePath = defaultDataSavePath;
            return;
        }
        
        // 如果路径与 globalState 不一致，则迁移数据
        const globalStateDataSavePath = context.globalState.get('dataSavePath');

        print('debug', 'The globalStateDataSavePath: ', globalStateDataSavePath);
        print('debug', 'The settingDataSavePath: ', settingDataSavePath);

        if (globalStateDataSavePath && globalStateDataSavePath !== settingDataSavePath) {
            performMigration(globalStateDataSavePath, settingDataSavePath);
        }
        // 记录路径到 globalState
        context.globalState.update('dataSavePath', settingDataSavePath);
    }

    dataSavePath = context.globalState.get('dataSavePath') ?? '';
    
    // 验证其他配置
    validateOtherSettings();
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
    return config.get('autoInitDatabase') ?? false;
}

/**
 * 获取调用关系显示位置
 * @returns {string} 调用关系显示位置
 */
function getRelationPosition()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('relationsPosition') ?? 'default';
}

/**
 * 获取编辑器标签页模式
 * @returns {string} 编辑器标签页模式
 */
function getRelationTabMode()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('relationsTabMode') ?? 'multiple';
}

/**
 * 获取自动更新间隔
 * @returns {number} 自动更新间隔
 */
function getAutoUpdateInterval()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('autoUpdateInterval') ?? 0;
}

/**
 * 验证数据保存路径
 * @param {string} dataPath 路径
 * @returns {boolean}
 */
function validateDataSavePath(dataPath) {
    if (!dataPath || typeof dataPath !== 'string') {
        return false;
    }
    
    // 检查是否为绝对路径
    if (!path.isAbsolute(dataPath)) {
        print('warning', `Data save path must be absolute: ${dataPath}`);
        return false;
    }
    
    return true;
}

/**
 * 验证其他配置
 */
function validateOtherSettings() {
    const config = vscode.workspace.getConfiguration('crelation');
    
    // 验证自动更新间隔
    const interval = config.get('autoUpdateInterval');
    if (typeof interval !== 'number' || interval < 0) {
        print('warning', `Invalid autoUpdateInterval: ${interval}, using default 0`);
        config.update('autoUpdateInterval', 0, true);
    }
    
    // 验证日志级别
    const logLevel = config.get('logLevel');
    const validLevels = ['debug', 'info', 'warn', 'error', 'off'];
    if (!validLevels.includes(logLevel)) {
        print('warning', `Invalid logLevel: ${logLevel}, using default 'error'`);
        config.update('logLevel', 'error', true);
    }

    // 验证调用关系显示位置
    const position = config.get('relationsPosition');
    const validPositions = ['default', 'right', 'bottom'];
    if (!validPositions.includes(position)) {
        print('warn', `Invalid relationsPosition: ${position}, using default 'default'`);
        config.update('relationsPosition', 'default', true);
    }

    // 验证编辑器标签页模式
    const tabMode = config.get('relationsTabMode');
    const validTabModes = ['multiple', 'single'];
    if (!validTabModes.includes(tabMode)) {
        print('warn', `Invalid relationsTabMode: ${tabMode}, using default 'multiple'`);
        config.update('relationsTabMode', 'multiple', true);
    }

    print('info', 'Configuration validation complete.');
}

module.exports = {
	initSetting,
    getDataSavePath,
    getAutoInitDatabase,
    getRelationPosition,
    getRelationTabMode,
    getAutoUpdateInterval,
    validateDataSavePath
};
