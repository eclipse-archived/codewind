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

const createNodeProject = (options, workspace) => {
    const creationArgs = {
        name: 'dummy',
        language: 'nodejs',
        ...options,
    };
    return createProjectAndCheckIsAnObject(creationArgs, workspace);
};

const createLibertyProject = (options, workspace) => {
    const creationArgs = {
        name: 'dummy',
        language: 'java',
        type: 'liberty',
        ...options,
    };
    return createProjectAndCheckIsAnObject(creationArgs, workspace);
};

const createSpringProject = (options, workspace) => {
    const creationArgs = {
        name: 'dummy',
        language: 'java',
        type: 'spring',
        ...options,
    };
    return createProjectAndCheckIsAnObject(creationArgs, workspace);
};

const createNodeProjectWithPackageJsonDependencies = (options, projectDir, dependencies) => {
    const project = createNodeProject(options, projectDir);
    const packageJSONPath = path.join(project.projectPath(), 'package.json');
    fs.outputJsonSync(packageJSONPath, { dependencies });
    return project;
};

const createLibertyProjectWithPomXml = (options, projectDir, pomXmlFileData) => {
    const project = createLibertyProject(options, projectDir);
    const pathToPomXml = path.join(project.projectPath(), 'pom.xml');
    fs.outputFileSync(pathToPomXml, pomXmlFileData);
    return project;
};

const createSpringProjectWithPomXml = (options, projectDir, pomXmlFileData) => {
    const project = createSpringProject(options, projectDir);
    const pathToPomXml = path.join(project.projectPath(), 'pom.xml');
    fs.outputFileSync(pathToPomXml, pomXmlFileData);
    return project;
};

module.exports = {
    createProject,
    createDummyProject,
    createNodeProject,
    createProjectAndCheckIsAnObject,
    createDefaultProjectAndCheckIsAnObject,
    createNodeProjectWithPackageJsonDependencies,
    createLibertyProjectWithPomXml,
    createSpringProjectWithPomXml,
};
