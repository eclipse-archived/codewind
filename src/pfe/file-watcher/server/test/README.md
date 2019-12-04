# Codewind Turbine Tests

## Test Suites

The Codewind Turbine Module currently has two test suites at the moment:
1. **Unit Test Suite**: This test suite calls each function directly without creating an instance of the turbine module. This is to test that we are able to write modular functions that can be tested standalone. This test suite also runs as part of the PR builds in the Codewind repo.

2. **Functional Test Suite**: This test suite creates an instance of turbine as a node module and calls each actionable function (i.e Create, Delete, Update, etc.). This is the bigger test suite out of the two and can be ran on either a local Codewind instance or a hosted Che instance on kube.

## How to run the test

### Unit Test Suite

Unit test suites are ran only on local. To run unit test on local, run the following commands:
- `cd src/pfe/file-watcher/server/`
- `npm i --only=dev`
- `npm run unit:test`

### Functional Test Suite

Functional test suites can be either ran on your local Codewind instance or on a hosted Che instance on kube.

#### Local

To run the functional test on local, run the following commands:
- `cd src/pfe/file-watcher/server/test/`
- `./test.sh`

#### Che (OpenShift Only)

Running on kube requires some additional configurations such as passing the cluster ip, password and namespace.

To run the functional test on kube, run the following commands:
- `cd src/pfe/file-watcher/server/test/`
- `CLUSTER_IP=<cluster_ip> CLUSTER_PORT=<cluster_port> CLUSTER_USER=<cluster_user> CLUSTER_PASSWORD=<cluster_password> ./test.sh -t kube -c y -p y`

The options `-t` takes in the type of test environment to run, by default it is `local`. The options `-c` and `-p` stands for clean up before running and post clean up after test has finished.

Additional options can be passed such as `DEPLOYMENT_REGISTRY` and `USER_DEVFILE` to overwrite the default values. The default deployment registry is: `docker-registry.default.svc:5000/che` and the default devfile is from https://github.com/eclipse/codewind-che-plugin/blob/master/devfiles/latest/devfile.yaml.

Don't have a Che instance? No worries, use the `che-setup.sh` script from https://github.com/eclipse/codewind-che-plugin/tree/master/scripts to deploy a che instance with codewind. More on how to deploy che automatically on the link above.

## Developing new test

### Unit Test Suite

To add new test cases under `unit-test`, go under `src/pfe/file-watcher/server/test/unit-test`. The main file that kicks of the test is `unit-test.ts` and subsequent test files are stored under `src/pfe/file-watcher/server/test/unit-test/tests`.

### Functional Test Suite

To add new test cases under `functional-test`, go under `src/pfe/file-watcher/server/test/functional-test`. The main file that kicks of the test is `functional-test.ts` and subsequent test suites are stored under `src/pfe/file-watcher/server/test/functional-test/suites`.

There are two types of suites:
- **Generic**: This suite has all the generic turbine functionalities such as setting locales, workspace settings and log level settings.
- **Project**: This suite has all the project specific functionalities such as create, delete, update and etc.

Generic suite is ran only once during the functional run whereas the project specific suite is ran across all supported project types.

To run the generic suite only:
- set `genericSuite.runTest(true);` in **runAllTests** functions in `src/pfe/file-watcher/server/test/functional-test/functional-test.ts`

To run the project specific suite only:
- set `projectSuite.runTest(projData, chosenTemplate, chosenProject, true);` in **runAllTests** functions in `src/pfe/file-watcher/server/test/functional-test/functional-test.ts`

Specific project types supported:
- **Codewind Default**
  - Liberty
  - Node.js
  - Spring
  - Swift
- **Generic Docker**
  - Go
  - Python
  - Lagom
- **OpenShift DO** (kube only)
  - Node.js
  - Perl
  - Python

To run only specific project types, comment out the project types not unwanted in **projectTypes** variable under `src/pfe/file-watcher/server/test/functional-test/configs/app.config.ts`.

## Debugging tests

All test logs are stored in the user root directory `~/test_results/`.

- To access `local` functional test result, go under `~/test_results/local/functional/` followed by the date the test was ran, followed by the time the test was run and the test run log would be stored under `local-functional-test.log`.

- To access `kube` functional test result, go under `~/test_results/kube/functional/` followed by the date the test was ran, followed by the time the test was run and the test run log would be stored under `kube-functional-test.log`.

- To access `unit` test result, go under `~/test_results/unit/` followed by the date the test was ran, followed by the time the test was run and the test run log would be stored under `unit-test.log`.

## Test Reports

There is daily report on our nightly run results in our [Mattermost channel](https://mattermost.eclipse.org/eclipse/channels/codewind-testing). Our nightly test run report consists of:
- Local Functional Test on Windows
- Local Functional Test on Linux
- Kube Functional Test on OKD3 Cluster
- Unit Test on Linux
- Codewind Sidecar on Linux (https://github.com/eclipse/codewind-che-plugin)
