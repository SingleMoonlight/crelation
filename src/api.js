const vscode = require('vscode');
const project = require('./project');
const parse = require('./parse');

function initDatabase()
{
    const projectPath = project.getProjectPath();
    project.addProject();
    parse.traverseDirectory(projectPath, true);
    vscode.window.showInformationMessage('Init database');
}

function updateDatabase()
{
    vscode.window.showInformationMessage('Update database');
}

function forceUpdateDatabase()
{
    vscode.window.showInformationMessage('Force update database');
}

function showRelations()
{
    vscode.window.showInformationMessage('Show relations');
}

module.exports = {
	initDatabase,
    updateDatabase,
    forceUpdateDatabase,
    showRelations
}
