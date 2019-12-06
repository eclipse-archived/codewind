/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
const fs = require('fs-extra');
const path = require('path');
const chai = require('chai');
const rewire = require('rewire');

const Project = rewire('../../src/pfe/portal/modules/Project');

const { suppressLogOutput } = require('./log.service');

suppressLogOutput(Project);
chai.should();

const createProject = (options, workspace) => {
    return new Project(options, workspace);
};

const createDummyProject = (extraOptions) => {
    const options = {
        name: 'dummy',
        ...extraOptions,
    };
    const workspace = '.';
    return createProject(options, workspace);
};

const createProjectAndCheckIsAnObject = (options, workspace) => {
    const project = new Project(options, workspace);
    project.should.be.an('object');
    return project;
};

const createDefaultProjectAndCheckIsAnObject = () => {
    const options = { name: 'dummy' };
    const workspace = global.codewind.CODEWIND_WORKSPACE;
    return createProjectAndCheckIsAnObject(options, workspace);
};


const createNodeProjectWithPackageJsonDependencies = (projectDir, dependencies) => {
    const project = createProjectAndCheckIsAnObject({ name: 'dummy', language: 'nodejs' }, projectDir);
    const packageJSONPath = path.join(project.projectPath(), 'package.json');
    fs.outputJsonSync(packageJSONPath, { dependencies });
    return project;
};

const exampleProject = {
    projectID: '0e018aa0-1515-11ea-9063-896c05b47bde',
    name: 'node3',
    codewindVersion: 'latest',
    language: 'nodejs',
    locOnDisk: '/Users/richard.waller@ibm.com/codewind-workspace/node3',
    host: '172.18.0.5',
    ports: {
        exposedPort: '32771',
        internalPort: '3000',
        internalDebugPort: '9229',
    },
    workspace: '/codewind-workspace/',
    directory: 'node3',
    infLockFlag: false,
    loadTestPath: '/codewind-workspace/node3/load-test',
    projectType: 'nodejs',
    buildLogPath: '/codewind-workspace/.logs/node3-0e018aa0-1515-11ea-9063-896c05b47bde/docker.build.log',
    state: 'open',
    autoBuild: true,
    injectMetrics: 'true',
    buildStatus: 'success',
    detailedBuildStatus: ' ',
    projectWatchStateId: 'ea72093628ff9aa1904c2a8de89bf009',
    ignoredPaths: [
        '/.project',
        '/run-dev',
        '/run-debug',
        '/package-lock.json*',
        '/nodejs_restclient.log',
        '/nodejs_dc.log',
        '/manifest.yml',
        '/idt.js',
        '/cli-config.yml',
        '/README.md',
        '/Jenkinsfile',
        '/.cfignore',
        '/load-test*',
        '*/node_modules*',
        '*/.git/*',
        '*/.DS_Store',
        '*/*.swp',
        '*/*.swx',
        '*/4913',
        '*/.dockerignore',
        '*/.gitignore',
        '*/*~',
        '/.settings',
        '/chart',
    ],
    appStatus: 'started',
    detailedAppStatus: {
        severity: 'INFO',
        message: 'Application started.',
        notify: false,
    },
    lastbuild: 1575543700071,
    appImageLastBuild: '1575543689000',
    location: '/codewind-workspace/node3',
    validationStatus: 'success',
    validationResults: [],
    isHttps: false,
    containerId: '63d21ae7e283372c0ac40d90517b651e3cc52fdb0bbefc15c0321197d5e21f0b',
    logs: {
        build: [
            {
                origin: 'workspace',
                files: [
                    '/codewind-workspace/.logs/node3-0e018aa0-1515-11ea-9063-896c05b47bde/docker.build.log',
                ],
            },
        ],
        app: [
            {
                origin: 'workspace',
                files: [
                    '/codewind-workspace/.logs/node3-0e018aa0-1515-11ea-9063-896c05b47bde/app.log',
                ],
            },
        ],
    },
    metricsAvailable: true,
};

module.exports = {
    createProject,
    createDummyProject,
    createProjectAndCheckIsAnObject,
    createDefaultProjectAndCheckIsAnObject,
    createNodeProjectWithPackageJsonDependencies,
    exampleProject,
};
