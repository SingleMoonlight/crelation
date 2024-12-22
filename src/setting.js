const vscode = require('vscode');
const path = require('path');
const os = require('os');

function initSetting()
{
    const config = vscode.workspace.getConfiguration('crelation');
    const dataSavePathKey = 'dataSavePath';
    const defaultDataSavePath = path.join(os.homedir(), '.crelation');

    // 如果用户没有设置路径，则设置默认路径
    if (config.get(dataSavePathKey) === undefined || config.get(dataSavePathKey) === '') {
        config.update(dataSavePathKey, defaultDataSavePath, true);
    }
}

function getDataSavePath()
{
    const config = vscode.workspace.getConfiguration('crelation');
    return config.get('dataSavePath');
}

module.exports = {
	initSetting,
    getDataSavePath
};
