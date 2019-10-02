# Codewind
![platforms](https://img.shields.io/badge/runtime-Java%20%7C%20Swift%20%7C%20Node-yellow.svg)
[![License](https://img.shields.io/badge/License-EPL%202.0-red.svg?label=license&logo=eclipse)](https://www.eclipse.org/legal/epl-2.0/)
[![Build Status](https://ci.eclipse.org/codewind/buildStatus/icon?job=Codewind%2Fcodewind%2Fmaster)](https://ci.eclipse.org/codewind/job/Codewind/job/codewind/job/master/)
[![Chat](https://img.shields.io/static/v1.svg?label=chat&message=mattermost&color=145dbf)](https://mattermost.eclipse.org/eclipse/channels/eclipse-codewind)

Build high-quality cloud-native applications for Kubernetes, regardless of your IDE or language.

Codewind enables you to create applications from a template or sample and includes support for launching, updating, testing, and debugging in  Docker containers on the desktop. Codewind also supports these features on Kubernetes. You can use Codewind to move existing applications to Docker and Kuberenetes. Codewind provides validation to ensure that applications follow best practices.

## Getting started

Use the following instructions to install Codewind with your choice of editor:
1. [VS Code extension](https://github.com/eclipse/codewind-vscode)
2. [Eclipse plugin](https://github.com/eclipse/codewind-eclipse)
3. [Eclipse Che plugin](https://github.com/eclipse/codewind-che-plugin)

## Building Codewind from the source
1. Clone the `codewind` repository.
2. Run the `./script/build.sh` script to run the Codewind build, or run the `./run.sh` script to build and start Codewind.

After you build Codewind with the build scripts, you can build one of the IDEs for Codewind:
- For Eclipse, see "Building" in the [`codewind-eclipse` repository](https://github.com/eclipse/codewind-eclipse/blob/master/README.md).
- For VS Code, see "Building Codewind from the source" in the [`codewind-vscode` repository](https://github.com/eclipse/codewind-vscode/blob/master/README.md).

## Contributing
We welcome submitting issues and contributions.
1. [Submitting bugs](https://github.com/eclipse/codewind/issues)
2. [Contributing](CONTRIBUTING.md)
3. [View the API documentation](https://eclipse.github.io/codewind/)

## License
[EPL 2.0](https://www.eclipse.org/legal/epl-2.0/)
