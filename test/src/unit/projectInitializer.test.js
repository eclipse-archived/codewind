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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const rewire = require('rewire');
const git = require('simple-git/promise');
const fs = require('fs-extra');
chai.use(chaiAsPromised);

// Mock the global variables.
global.codewind = {};


const ProjectInitializerError = require('../../../src/pfe/portal/modules/utils/errors/ProjectInitializerError');
const projectInitializer = rewire('../../../src/pfe/portal/modules/projectInitializer');
const { testTimeout } = require('../../config');

const initializeProjectFromLocalDir = projectInitializer.__get__('initializeProjectFromLocalDir');

// This mocks the dockerode createContainer error for an unmountable path
const dockerCreateContainerMock = () => {
    throw ({
        statusCode: 502,
        json: 'Mounts denied',
    });
};

const revert = projectInitializer.__set__('docker.createContainer', dockerCreateContainerMock);

const validTestPath = '/tmp/';
const user = null;

describe('projectInitializer.js', () => {
    describe('initializeProjectFromLocalDir(user, projectPath)', () => {
        describe('Invalid args', () => {
            describe('Invalid path Type', () => {
                it('throws INVALID_TYPE error', () => {
                    return (initializeProjectFromLocalDir(user, {}))
                        .should.eventually.be.rejectedWith(ProjectInitializerError.PATH_INVALID_TYPE);
                });
            });
            describe('Non-absolute path', () => {
                it('throws NOT_ABSOLUTE error', () => {
                    const otherwiseValidPath = 'codewind';
                    return (initializeProjectFromLocalDir(user, otherwiseValidPath))
                        .should.eventually.be.rejectedWith(ProjectInitializerError.NOT_ABSOLUTE);
                });
            });
            describe('Project path which is not known to docker', () => {
                it('throws NOT_MOUNTABLE error', function() {
                    this.timeout(testTimeout.short);
                    return (initializeProjectFromLocalDir(user, validTestPath))
                        .should.eventually.be.rejectedWith(ProjectInitializerError.PATH_NOT_MOUNTABLE);
                });
                after(() => {
                    revert();
                });
            });
        });
        describe('Valid args', () => {
            let projectPath;

            afterEach(async function() {
                this.timeout(2 * testTimeout.med);
                // after is failing in jenkins with permission issues.  This is not
                // actually part of the test, its us trying to be good and clean up   

                //await fs.remove(projectPath);
            });

            describe('empty project', () => {
                it('should return success status, language: "unknown", projectType: "docker", when validating generic project', function() {
                    this.timeout(testTimeout.med);
                    projectPath =  '/tmp/dockerbindcontrollertest';
                    const expectedResponse = {
                        status: 'success',
                        projectPath,
                        result: {
                            language: 'unknown',
                            projectType: 'docker',
                        },
                    };
                    return initializeProjectFromLocalDir(user, projectPath)
                        .should.eventually.deep.equal(expectedResponse);
                });
            });
            describe('nodejs', () => {
                it('should return success status, language: "nodejs", projectType: "nodejs", when validating nodejs project', async function() {
                    this.timeout(testTimeout.med);
                    projectPath = '/tmp/nodejscontrollertest';
                    await git().clone('https://github.com/microclimate-dev2ops/nodeExpressTemplate', projectPath);
                    const expectedResponse = {
                        status: 'success',
                        projectPath,
                        result: {
                            language: 'nodejs',
                            projectType: 'nodejs',
                        },
                    };
                    return initializeProjectFromLocalDir(user, projectPath)
                        .should.eventually.deep.equal(expectedResponse);
                });
            });
            describe('swift', () => {
                it('should return success status, language: "swift", projectType: "swift", when validating swift project', async function() {
                    this.timeout(testTimeout.med);
                    projectPath = '/tmp/swiftbindcontrollertest';
                    await git().clone('https://github.com/microclimate-dev2ops/swiftTemplate.git', projectPath);
                    const expectedResponse = {
                        status: 'success',
                        projectPath,
                        result: {
                            language: 'swift',
                            projectType: 'swift',
                        },
                    };
                    return initializeProjectFromLocalDir(user, projectPath)
                        .should.eventually.deep.equal(expectedResponse);
                });
            });

            describe('liberty', () => {
                it('should return success status, language: "java", projectType: "liberty", when validating liberty project', async function() {
                    this.timeout(testTimeout.med);
                    projectPath = '/tmp/libertybindcontrollertest';
                    await git().clone('https://github.com/microclimate-dev2ops/javaMicroProfileTemplate.git', projectPath);
                    const expectedResponse = {
                        status: 'success',
                        projectPath,
                        result: {
                            language: 'java',
                            projectType: 'liberty',
                        },
                    };
                    return initializeProjectFromLocalDir(user, projectPath)
                        .should.eventually.deep.equal(expectedResponse);
                });
            });
            describe('spring', () => {
                it('should return success status, language: "java", projectType: "spring", when validating spring project', async function() {
                    this.timeout(testTimeout.med);
                    projectPath = '/tmp/springbindcontrollertest';
                    await git().clone('https://github.com/microclimate-dev2ops/springJavaTemplate.git', projectPath);
                    const expectedResponse = {
                        status: 'success',
                        projectPath,
                        result: {
                            language: 'java',
                            projectType: 'spring',
                        },
                    };
                    return initializeProjectFromLocalDir(user, projectPath)
                        .should.eventually.deep.equal(expectedResponse);
                });
            });
        });
    });
});
