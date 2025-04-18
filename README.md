# C Relation VS Code Extension

C Language Call Chain Visualization Plugin.

## Details

This plugin is used to visualize the call chain of the C language program.

How to use:

1.Open your C language project.

2.Open the command palette (Ctrl+Shift+P) and select `C Relation: Init database`. The first time it will take a long time to scan the whole project and build the database.

3.**Select** a function name and then open right click menu and select `Show Relations`. You can see the call chain of the function in a new panel.

If you want show relations by a shortcut key, you can add the following code to your `keybindings.json` file. For example: 

```
{
    "key": "ctrl+alt+r",
    "command": "crelation.showRelations",
    "when": "editorTextFocus && editorHasSelection"
}
```

4.In the new panel, you can click the function name to collapse or expand the call chain. Moreover, it will just jump to the function code when you right click the function name. If the tree nodes are too many, you can drag the tree to make it easier to read.

![How to use](images/how_to_use.gif)

![Zoom](images/zoom.gif)

5.If you have modified the C language project, you can update the database by running the command `C Relation: Update database`. It will only scan the updated files. If you want to update the whole database, you can run the command `C Relation: Force update database`.

## Issues
If you have any questions, please contact me at [GitHub](https://github.com/SingleMoonlight/crelation).

Before asking questions, please open the VS Code output panel and check the log of `C Relation`. It's better if you can open `Help` -> `Toggle Developer Tools` to see if there are any errors. It will help me to solve your problem.

## Q&A
1.command 'crelation.init' not found

If you encounter this problem, it most be because you uses the extension in some Linux system which is not supported GLIBCXX_3.4.29. 

You can use `strings /usr/lib/x86_64-linux-gnu/libstdc++.so.6 | grep GLIBCXX` to check the version of GLIBCXX. If the version is lower than 3.4.29, you can try to install a newer version of GLIBCXX. There is no a good solution for this problem at present.

2.Incorrect parsing on macros nested with logical expressions
For example:
```c
if (
#ifdef TEST_MACRO
    !func() &&
#endif
    boolean_expression)
{
    // do something
}
```

This is a bug of tree-sitter-c. I have submitted a issue to the repository of tree-sitter-c. However, I don't know when it will be fixed.

This bug has a small probability of affecting the parsing results, manifested as the caller of a function being displayed as global, but it does not affect the jump function.


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
| crelation.autoInitDatabase | Whether to init the database automatically when opening a project | `off` |
| crelation.autoUpdateInterval | The interval to update the database automatically when opening a project. The unit is minutes. Default is 0, which means no auto update. Changed value will take effect after **REBOOT** the VS Code. | 0 |
| crelation.relationsPosition | The position of the relations shown | `default` |
| crelation.relationsPanelMode | The mode of the relations panel.                             | `multiple`              |
| crelation.logLevel     | The log level of the extension     | `error`                   |
