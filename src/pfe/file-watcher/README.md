# FileWatcher

This directory consists of the filewatcher modules used to build the respective microclimate container.

## Directory Structure
```
file-watcher/
├── README.md
├── build
├── charts
├── dockerfiles
├── idc
├── pomCache
├── scripts
├── server
└── test
```

# Import Filewatcher as a node module
1. In `package.json` file, add dependency
    ```
      "dependencies": {
            "file-watcher": "file:<relative_path_to_filewatcher_folder>/server",
      }
    ```
2. Import Filewatcher module and initialize
    ```
        const fw = require('file-watcher');
        const filewatcher = new fw();
    ```
3. Example usage of a Filewatcher function
    ```
        const response = await filewatcher.createProject(projectInfo);
    ```
    To register listener for events from Filewatcher module
    ```
        filewatcher.registerListener({
            name: "eventListener",
            handleEvent: async (event, eventDetails) => {
                // event is the event string, eventDetails is the detailed message of the event
                ... ...
            }
        });
    ```

  