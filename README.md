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

## Feedback and Community

Have any questions or commments on Codewind? Or would like to get involved in some way? Here's how you can get in touch with us:
- **Support:** You can ask questions, report bugs, and request features using [GitHub issues](https://github.com/eclipse/codewind/issues).
- **Public Chat:** Join the public [eclipse-codewind](https://mattermost.eclipse.org/eclipse/channels/eclipse-codewind) and [eclipse-codewind-dev](https://mattermost.eclipse.org/eclipse/channels/eclipse-codewind-dev) Mattermost channels
- **Twitter:** [@EclipseCodewind](https://twitter.com/EclipseCodewind)
- **Mailing List:** [codewind-dev@eclipse.org](https://accounts.eclipse.org/mailing-list/codewind-dev)
- **Weekly Meetings:** We hold [weekly calls](https://github.com/eclipse/codewind/wiki/Codewind-Calls) every Tuesday and Thursday at 9:00 AM EST / 2:00 PM GMT.

## Contributing
We welcome submitting issues and contributions.
- [Submitting bugs](https://github.com/eclipse/codewind/issues)
- [Contributing](CONTRIBUTING.md)
- [View the API documentation](https://eclipse.github.io/codewind/)
- [Improve docs](https://github.com/eclipse/codewind-docs)
- [Codewind architecture](https://github.com/codewind-resources/design-documentation)
- [Codewind repositories](https://github.com/eclipse?utf8=%E2%9C%93&q=codewind&type=&language=)
- [Good first issues for new contributors](https://github.com/eclipse/codewind/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

## Building Codewind from the source
1. Clone the `codewind` repository.
2. Run the `./script/build.sh` script to run the Codewind build, or run the `./run.sh` script to build and start Codewind.

After you build Codewind with the build scripts, you can build one of the IDEs for Codewind:
- For Eclipse, see "Building" in the [`codewind-eclipse` repository](https://github.com/eclipse/codewind-eclipse/blob/master/README.md).
- For VS Code, see "Building Codewind from the source" in the [`codewind-vscode` repository](https://github.com/eclipse/codewind-vscode/blob/master/README.md).

## Developing - Attaching a Node.js debugger in VSCode
Codewind contains two debugging tools for VSCode in the `.vscode/launch.json` file.
To use these you should:
1. Clone the `codewind` repository.
2. Copy the `src/pfe/devbuild-example.env` file to `src/pfe/devbuild.env` to turn on the Node.js inspect (See `src/pfe/package.json`).
3. Run the `./run.sh` script to build and start Codewind.
4. Open the Codewind directory in VSCode (Something like `code github/codewind`).
5. Open the debugging tab and select one of the debugging options.


## License
[EPL 2.0](https://www.eclipse.org/legal/epl-2.0/)
