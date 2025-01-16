# C Relation VS Code Extension

C Language Call Chain Visualization Plugin.

## Details

This plugin is used to visualize the call chain of the C language program.

How to use:

1. Open your C language project.
2. Open the command palette (Ctrl+Shift+P) and select "C Relation: Init database". The first time it will take a long time to scan the project and build the database.
3. Select a function in your C language project. Then open right click menu and select "Show Relations". You can see the call chain of the function in a new panel.
4. In the new panel, you can click on the function name to collapse or expand the call chain. Moreover, you can right click on the function name to jump to the function code. When the tree node is too many, you can drag the tree to make it easier to read.
5. If you update the C language project, you can update the database by running the command "C Relation: Update database". It will only scan the updated files. If you want to update the whole database, you can run the command "C Relation: Force update database".

![How to use](images/how_to_use.gif)

## Issues
If you have any questions, please contact me at [github](https://github.com/SingleMoonlight/crelation).

Before asking questions, please open the VS Code output panel and check the log. It's better if you can open `Help` -> `Toggle Developer Tools` to see if there are any errors. It will help me to solve your problem.

## Q&A
+ command 'crelation.init' not found

If you encounter this problem, it most be because you uses the extension in some Linux system which is not supported GLIBCXX_3.4.29. You can use `strings /usr/lib/x86_64-linux-gnu/libstdc++.so.6 | grep GLIBCXX` to check the version of GLIBCXX. If the version is lower than 3.4.29, you can try to install a newer version of GLIBCXX. There is no a good solution for this problem at present.

## Features

### Activation Events
+ onStartupFinished

### Commands

| ID                      | Title                            | Description                               |
| ----------------------- | -------------------------------- | ----------------------------------------- |
| crelation.init          | C Relation: Init database         | Scan the project and build the database   |
| crelation.update        | C Relation: Update database       | Scan the changed file and update database |
| crelation.forceUpdate   | C Relation: Force update database | Scan the project and rebuild the database |
| crelation.showRelations | Show Relations                   | Show the function call                    |

### Settings

| ID                     | Description                        | Default                 |
| ---------------------- | ---------------------------------- | ----------------------- |
| crelation.dataSavePath | The path to save the database file | `<username>/.crelation` |
| crelation.logLevel     | The log level of the extension     | `off`                   |
