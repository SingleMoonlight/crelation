const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { getDataSavePath } = require('../frame/setting');
const { print } = require('../util/log');

/**
 * 获取当前打开项目的完整目录
 * @returns 项目路径
 */
function getProjectPath() {
    // 获取当前打开项目的完整目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        print('info', 'No project is currently open');
        return;
    }

    return workspaceFolders[0].uri.fsPath;
}

/**
 * 获取当前项目名称
 * @returns 项目信息名称
 */
function getProjectName() {
    const projectPath = getProjectPath();
    return path.basename(projectPath);
}

/**
 * 获取项目列表
 * @returns 项目列表
 */
async function getProjects() {
    try {
        const projectDataFile = path.join(getDataSavePath(), 'project.json');
        const data = await fs.readFile(projectDataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            print('error', `Failed to read project.json: ${err.message}`);
            return [];
        }
    }
}

/**
 * 生成较短的唯一标识符
 * @returns 短 UUID
 */
function generateShortUid(length = 8) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * 添加项目
 */
async function addProject() {
    const projectPath = getProjectPath();
    const projectName = getProjectName();

    // 生成唯一的 uid
    const uid = generateShortUid();
    print('info', `Generated UID: ${uid}`);

    // 读取现有的 project.json 文件内容
    let projects = await getProjects();
    if (!Array.isArray(projects)) {
        projects = [];
    }

    // 检查 project.json 文件中是否已经有该项目
    for (const project of projects) {
        if (project.path === projectPath) {
            return;
        }
    }

    // 添加新的项目对象
    projects.push({
        path: projectPath,
        name: projectName,
        uid: uid
    });

    // 写入更新后的 project.json 文件
    try {
        const projectDataFile = path.join(getDataSavePath(), 'project.json');
        await fs.writeFile(projectDataFile, JSON.stringify(projects, null, 2), 'utf8');
        print('info', 'Project added successfully.');
    } catch (err) {
        print('error', `Failed to write project.json: ${err.message}`);
    }

    // 创建该项目数据保存文件夹
    await fs.mkdir(path.join(getDataSavePath(), uid + '-' + projectName), { recursive: true });
}

/**
 * 获取当前项目数据库路径
 */
async function getProjectDatabasePath() {
    const projectPath = getProjectPath();
    let projects = await getProjects();

    if (!Array.isArray(projects)) {
        projects = [];
    }

    for (const project of projects) {
        if (project.path === projectPath) {
            return path.join(getDataSavePath(), project.uid + '-' + project.name);
        }
    }
}

module.exports = {
    addProject,
    getProjectPath,
    getProjectDatabasePath
};