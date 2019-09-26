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
1. Install [Eclipse](https://www.eclipse.org/codewind/mdteclipsegettingstarted.html) or [VS Code](https://www.eclipse.org/codewind/mdt-vsc-getting-started.html).
2. Clone the `codewind` repository.
3. Clone the Eclipse or VS Code repository:
   - If you want to build the Eclipse plug-in, clone the [`codewind-eclipse` repo](https://github.com/eclipse/codewind-eclipse).
   - If you want to build the VS Code plug-in, clone the [`codewind-vscode` repo](https://github.com/eclipse/codewind-vscode).
4. Run the `./run.sh` script to generate the Codewind builds and images.
5. Run the plug-in that corresponds to the repository that you cloned:
   - For the Eclipse plug-in, follow the [Building section instructions](https://github.com/eclipse/codewind-eclipse/blob/master/README.md).
   - For the VS Code plug-in, follow the [Developing section instructions](https://github.com/eclipse/codewind-vscode/blob/master/README.md).

## Contributing
We welcome submitting issues and contributions.
1. [Submitting bugs](https://github.com/eclipse/codewind/issues)
2. [Contributing](CONTRIBUTING.md)
3. [View the API documentation](https://eclipse.github.io/codewind/)

## License
[EPL 2.0](https://www.eclipse.org/legal/epl-2.0/)
