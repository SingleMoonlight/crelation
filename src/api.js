const vscode = require('vscode');

function initDatabase()
{
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
