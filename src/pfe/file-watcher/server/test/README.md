# Codewind Turbine Tests

## Test Suites

The Codewind Turbine Module currently has two test suites at the moment:
1. **Unit Test Suite**: This test suite calls each function directly without creating an instance of the turbine module. This is to test that we are able to write modular functions that can be tested standalone. This test suite also runs as part of the PR builds in the Codewind repo.

2. **Functional Test Suite**: This test suite creates an instance of turbine as a node module and calls each actionable function (i.e Create, Delete, Update, etc.). This is the bigger test suite out of the two and can be ran on either a local Codewind instance or a hosted Che instance on kube.

3. **Performance Test Suite**: This test suite uses the functional test suite to run turbine performance metrics. This suite tests the main functionalities such as Create, Update and Delete. It uses the functional test suite code to run the performance test.

## How to run the test

### Unit Test Suite

Unit test suites do not require a codewind instance to be up. It tests the standalone turbine functionality. To run unit test on local, run the following commands:
- `cd src/pfe/file-watcher/server/`
- `npm i --only=dev`
- `npm run unit:test`

### Functional Test Suite

Functional test suites require a Codewind instance running either locally or on a hosted Kubernetes cluster with Eclipse Che.

#### Local

To run the functional test on local, run the following commands:
- `cd src/pfe/file-watcher/server/test/`
- `./test.sh`

#### Che (OpenShift Only)

Running on kube requires some additional configurations such as passing the cluster ip, password and namespace.

To run the functional test on kube, run the following commands:
- `cd src/pfe/file-watcher/server/test/`
- `CLUSTER_IP=<cluster_ip> CLUSTER_PORT=<cluster_port> CLUSTER_USER=<cluster_user> CLUSTER_PASSWORD=<cluster_password> ./test.sh -t kube -c y -p y`

The options `-t` takes in the type of test environment to run, by default it is `local`. The options `-c` and `-p` stands for clean up before running and post clean up after test has finished. For additional information, check `./test.sh --help`.

Additional options can be passed such as `IMAGE_PUSH_REGISTRY_ADDRESS`, `IMAGE_PUSH_REGISTRY_NAMESPACE` and `USER_DEVFILE` to overwrite the default values. 

The default values are:
- **IMAGE_PUSH_REGISTRY_ADDRESS**: docker-registry.default.svc:5000/che
- **IMAGE_PUSH_REGISTRY_NAMESPACE**: eclipse-che
- **USER_DEVFILE**: https://raw.githubusercontent.com/eclipse/codewind-che-plugin/master/devfiles/latest/devfile.yaml

Don't have a Che instance? No worries, use the `che-setup.sh` script from https://github.com/eclipse/codewind-che-plugin/tree/master/scripts to deploy a che instance with codewind. More on how to deploy che automatically [here](https://github.com/eclipse/codewind-che-plugin/blob/master/scripts/README.md).

### Performance Test Suite

Performance test suite can be ran either on local or kube, similar to Functional Test Suite. To run the performance test, run the following commands:
- `cd src/pfe/file-watcher/server/test/performance-test`
- `./performance-run.sh --release=<base_release>`

By default, the performance run is defaulted to run 10 iterations. The option to run for fewer or more iterations can be passed to the script. For additional information on the script options, check `./performance-run.sh --help`.

## Developing new tests

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

To run only specific project types, comment out the unwanted project types in **projectTypes** variable under `src/pfe/file-watcher/server/test/functional-test/configs/app.config.ts`.

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
