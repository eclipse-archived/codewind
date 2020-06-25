/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
*******************************************************************************/
global.codewind = { RUNNING_IN_K8S: false };
const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const Links = rewire('../../../../src/pfe/portal/services/links.service');
const ProjectLinkError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectLinkError');
const { suppressLogOutput } = require('../../../modules/log.service');

chai.use(chaiAsPromised);
chai.should();

describe('links.service.js', () => {
    suppressLogOutput(Links);
    describe('emitStatusToUI(user, project, status, link, err = null)', () => {
        const emitStatusToUI = Links.__get__('emitStatusToUI');
        const defaultTest = {
            projectName: 'projectName',
            projectID: 'projectID',
            status: 'failure',
        };

        const testEmit = (name, projectID, status, link, error) => {
            return (event, data) => {
                event.should.equal('projectLink');
                data.should.deep.equal({
                    name,
                    projectID,
                    status,
                    link,
                    error,
                });
            };
        };

        it(`emits a success status with no error`, () => {
            const { name, projectID } = defaultTest;
            const status = 'success';
            const link = { projectID: 'dummyProjectID' };
            const emit = testEmit(name, projectID, status, link, null);
            emitStatusToUI({ uiSocket: { emit } }, { name, projectID }, status, link);
        });
        it(`emits a failure status with an error object that has no info property`, () => {
            const { name, projectID } = defaultTest;
            const status = 'success';
            const link = { projectID: 'dummyProjectID' };
            const error = { code: 'noinfo' };
            const emit = testEmit(name, projectID, status, link, error);
            emitStatusToUI({ uiSocket: { emit } }, { name, projectID }, status, link, error);
        });
        it(`emits a failure status with an error object that has an info property, so returns only the info property`, () => {
            const { name, projectID } = defaultTest;
            const status = 'success';
            const link = { projectID: 'dummyProjectID' };
            const error = { info: { code: 'info' } };
            const emit = testEmit(name, projectID, status, link, error.info);
            emitStatusToUI({ uiSocket: { emit } }, { name, projectID }, status, link, error);
        });
    });
    describe('handleProjectRestartAndSocketEmit(user, project, link, forceRebuild)', () => {
        const sandbox = sinon.createSandbox();
        afterEach(() => {
            sandbox.restore();
        });
        const { handleProjectRestartAndSocketEmit } = Links;
        const defaultTest = {
            name: 'projectName',
            projectID: 'projectID',
            status: 'failure',
        };

        it(`emits a success status with no error when the project is closed`, () => {
            const { name, projectID } = defaultTest;
            const link = { projectID: 'targetProjectID' };
            const emit = sinon.spy();
            const mockedProject = {
                name,
                projectID,
                toJSON: sinon.stub().returns({ name, projectID }),
                isOpen: sinon.stub().returns(false),
            };
            handleProjectRestartAndSocketEmit({ uiSocket: { emit } }, mockedProject, link);
            emit.should.be.calledTwice;
            emit.firstCall.should.be.calledWith('projectChanged', mockedProject.toJSON());
            emit.secondCall.should.be.calledWith('projectLink', {
                projectID,
                name,
                status: 'success',
                link,
                error: null,
            });
        });
        it(`emits a failure status when the project is open and restartProjectToPickupLinks throws an error`, () => {
            const errorToThrow = new Error();
            Links.__set__('restartProjectToPickupLinks', () => { throw errorToThrow; });
            const { name, projectID } = defaultTest;
            const link = { projectID: 'targetProjectID' };
            const emit = sinon.spy();
            const mockedProject = {
                name,
                projectID,
                toJSON: sinon.stub().returns({ name, projectID }),
                isOpen: sinon.stub().returns(true),
            };
            handleProjectRestartAndSocketEmit({ uiSocket: { emit } }, mockedProject, link);
            emit.should.be.calledTwice;
            emit.firstCall.should.be.calledWith('projectChanged', mockedProject.toJSON());
            emit.secondCall.should.be.calledWith('projectLink', {
                projectID,
                name,
                status: 'error',
                link,
                error: errorToThrow,
            });
        });
    });
    describe('verifyTargetProjectExists(user, projectID)', () => {
        const { verifyTargetProjectExists } = Links;
        it('throws an error as the project cannot be retrieved', () => {
            const user = {
                projectList: {
                    retrieveProject: () => false,
                },
            };
            (() => verifyTargetProjectExists(user, 'dummyid')).should.throw(ProjectLinkError)
                .and.have.property('code', 'TARGET_PROJECT_NOT_FOUND');
        });
        it('returns the project as it can be retrieved', () => {
            const user = {
                projectList: {
                    retrieveProject: () => { return { projectID: 'dummyid' }; },
                },
            };
            const project = verifyTargetProjectExists(user, 'dummyid');
            project.should.deep.equal({ projectID: 'dummyid' });
        });
    });
    describe('getProjectURL(project)', () => {
        const { getProjectURL } = Links;
        describe('RUNNING_IN_K8S === false', () => {
            const originalK8s = global.codewind.RUNNING_IN_K8S;
            before(() => {
                global.codewind.RUNNING_IN_K8S = false;
            });
            after(() => {
                global.codewind.RUNNING_IN_K8S = originalK8s;
            });
            it('returns a project URL as both the container and ports have values', async() => {
                const mockDockerInspect = () => ({ Name: '/codewind-pfe' });
                Links.__set__('cwUtils', { inspect: mockDockerInspect });
                const project = {
                    ports: {
                        internalPort: 3000,
                    },
                };
                const url = await getProjectURL(project);
                url.should.equal('codewind-pfe:3000');
            });
            it('throws an error as the container returned from inspect is null', async() => {
                const mockDockerInspect = () => null;
                Links.__set__('cwUtils', { inspect: mockDockerInspect });
                const project = {
                    ports: {
                        internalPort: 3000,
                    },
                };
                await getProjectURL(project)
                    .should.eventually.be.rejectedWith(ProjectLinkError)
                    .and.have.property('code', ProjectLinkError.CODES.CONTAINER_NOT_FOUND);
            });
            it('throws an error as the project does not have a port object', async() => {
                const mockDockerInspect = () => ({ Name: '/codewind-pfe' });
                Links.__set__('cwUtils', { inspect: mockDockerInspect });
                await getProjectURL({})
                    .should.eventually.be.rejectedWith(ProjectLinkError)
                    .and.have.property('code', ProjectLinkError.CODES.CONTAINER_NOT_FOUND);
            });
        });
        describe('RUNNING_IN_K8S === true', () => {
            const originalK8s = global.codewind.RUNNING_IN_K8S;
            before(() => {
                global.codewind.RUNNING_IN_K8S = true;
            });
            after(() => {
                global.codewind.RUNNING_IN_K8S = originalK8s;
            });
            it('returns a project URL as both serviceName and port are returned from project.getProjectKubeService', async() => {
                const getProjectKubeService = () => ({ serviceName: 'codewind-pfe', port: 3000 });
                const url = await getProjectURL({ getProjectKubeService });
                url.should.equal('codewind-pfe:3000');
            });
            it('throws an error as a serviceName is not returned', async() => {
                const getProjectKubeService = () => ({ port: 3000 });
                await getProjectURL({ getProjectKubeService })
                    .should.eventually.be.rejectedWith(ProjectLinkError)
                    .and.have.property('code', ProjectLinkError.CODES.SERVICE_NOT_FOUND);
            });
            it('throws an error as a port is not returned', async() => {
                const getProjectKubeService = () => ({ serviceName: 'codewind-pfe' });
                await getProjectURL({ getProjectKubeService })
                    .should.eventually.be.rejectedWith(ProjectLinkError)
                    .and.have.property('code', ProjectLinkError.CODES.SERVICE_NOT_FOUND);
            });
        });
    });
    describe('restartProjectToPickupLinks(user, project, forceRebuild)', () => {
        const { restartProjectToPickupLinks } = Links;
        describe('RUNNING_IN_K8S === false', () => {
            const originalK8s = global.codewind.RUNNING_IN_K8S;
            const sandbox = sinon.createSandbox();
            before(() => {
                global.codewind.RUNNING_IN_K8S = false;
            });
            after(() => {
                global.codewind.RUNNING_IN_K8S = originalK8s;
            });
            ['nodejs', 'liberty', 'spring'].forEach(projectType => {
                it(`calls restartNodeSpringLiberty as the project type is ${projectType}`, async() => {
                    const spiedRestartNodeSpringLiberty = sandbox.spy(() => {});
                    const spiedRestartDocker = sandbox.spy(() => {});

                    Links.__set__('restartNodeSpringLiberty', spiedRestartNodeSpringLiberty);
                    Links.__set__('restartDocker', spiedRestartDocker);

                    await restartProjectToPickupLinks({}, { projectType });

                    spiedRestartNodeSpringLiberty.should.be.calledOnce;
                    spiedRestartDocker.should.not.be.called;
                });
            });
            ['swift', 'docker', 'appsody', 'anythingelse'].forEach(projectType => {
                it(`calls restartProject as the project type is ${projectType}`, async() => {
                    const spiedRestartNodeSpringLiberty = sandbox.spy(() => {});
                    const spiedRestartProject = sandbox.spy(() => {});

                    Links.__set__('restartNodeSpringLiberty', spiedRestartNodeSpringLiberty);
                    Links.__set__('restartProject', spiedRestartProject);

                    await restartProjectToPickupLinks({}, { projectType });

                    spiedRestartNodeSpringLiberty.should.not.be.called;
                    spiedRestartProject.should.be.calledOnce;
                });
            });
        });
        describe('RUNNING_IN_K8S === true', () => {
            const originalK8s = global.codewind.RUNNING_IN_K8S;
            const sandbox = sinon.createSandbox();
            before(() => {
                global.codewind.RUNNING_IN_K8S = true;
            });
            after(() => {
                global.codewind.RUNNING_IN_K8S = originalK8s;
            });
            it('calls updateNetworkConfigMap as the project is a Codewind project', async() => {
                const cwUtils = {
                    getNetworkConfigMap: () => true,
                    updateConfigMap: () => true,
                    patchProjectDeployments: () => true,
                };
                const spiedCwUtils = sandbox.spy(cwUtils);
                Links.__set__('cwUtils', spiedCwUtils);
                const spiedRestartProject = sandbox.spy(() => {});
                Links.__set__('restartProject', spiedRestartProject);
                await restartProjectToPickupLinks({}, { links: { getEnvPairObject: () => ({}) } });
                const { getNetworkConfigMap, updateConfigMap, patchProjectDeployments } = spiedCwUtils;
                getNetworkConfigMap.should.be.calledOnce;
                updateConfigMap.should.be.calledOnce;
                patchProjectDeployments.should.be.calledOnce;
                spiedRestartProject.should.not.be.called;
            });
            it(`calls restartProject as the project is an extension`, async() => {
                const spiedUpdateNetworkConfigMap = sandbox.spy(() => {});
                const spiedRestartProject = sandbox.spy(() => {});

                Links.__set__('updateNetworkConfigMap', spiedUpdateNetworkConfigMap);
                Links.__set__('restartProject', spiedRestartProject);

                await restartProjectToPickupLinks({}, { extension: true });

                spiedUpdateNetworkConfigMap.should.not.be.called;
                spiedRestartProject.should.be.calledOnce;
            });
        });
    });
    describe('restartNodeSpringLiberty(user, project)', () => {
        const restartNodeSpringLiberty = Links.__get__('restartNodeSpringLiberty');
        const sandbox = sinon.createSandbox();

        const mockedCwUtils = {
            getProjectSourceRoot: () => null,
            copyFile: () => null,
            deleteFile: () => null,
        };
        const mockedUser = {
            restartProject: () => null,
        };
        const mockedLinks = {
            getFileName: () => 'dummyFileName',
            getFilePath: () => null,
        };

        beforeEach(() => {
            sandbox.spy(mockedCwUtils, 'copyFile');
            sandbox.spy(mockedCwUtils, 'deleteFile');
            sandbox.spy(mockedUser, 'restartProject');
            Links.__set__('cwUtils', mockedCwUtils);
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('calls copyFile as linkFileExists is true', async() => {
            const mockedProject = { links: { ...mockedLinks, envFileExists: () => true } };
            await restartNodeSpringLiberty(mockedUser, mockedProject);

            const { copyFile, deleteFile } = mockedCwUtils;
            copyFile.should.be.calledOnce;
            deleteFile.should.not.be.called;
        });
        it('calls deleteFile as linkFileExists is false', async() => {
            const mockedProject = { links: { ...mockedLinks, envFileExists: () => false } };
            await restartNodeSpringLiberty(mockedUser, mockedProject);

            const { copyFile, deleteFile } = mockedCwUtils;
            copyFile.should.not.be.called;
            deleteFile.should.be.calledOnce;
        });
        it('checks that mode defaults to "run" if startMode is null', async() => {
            const mockedProject = { links: { ...mockedLinks, envFileExists: () => false } };
            await restartNodeSpringLiberty(mockedUser, mockedProject);
            mockedUser.restartProject.should.be.calledWith(mockedProject, 'run');
        });
        it('checks that mode equals "debug" when it is given as the startMode', async() => {
            const mockedProject = { startMode: 'debug', links: { ...mockedLinks, envFileExists: () => false } };
            await restartNodeSpringLiberty(mockedUser, mockedProject);
            mockedUser.restartProject.should.be.calledWith(mockedProject, 'debug');
        });
    });
    describe('updateNetworkConfigMap(project)', () => {
        const updateNetworkConfigMap = Links.__get__('updateNetworkConfigMap');
        it('does not error as the configMap has been found and updated successfully', async() => {
            const cwUtils = {
                getNetworkConfigMap: () => true,
                updateConfigMap: () => true,
            };
            Links.__set__('cwUtils', cwUtils);
            const links = {
                getEnvPairObject: () => ({ }),
            };
            await updateNetworkConfigMap({ links });
        });
        it('calls updateConfigMap with the original configMap object plus a new data object', async() => {
            const originalConfigMap = { metadata: { name: 'name' } };
            const envPairObject = { obj1: 'val', obj2: 'val' };
            const cwUtils = {
                getNetworkConfigMap: () => originalConfigMap,
                updateConfigMap: (newConfigMap) => newConfigMap.should.deep.equal({ ...originalConfigMap, data: envPairObject }),
            };
            Links.__set__('cwUtils', cwUtils);
            const links = {
                getEnvPairObject: () => envPairObject,
            };
            await updateNetworkConfigMap({ links });
        });
        it('throws an error when no configMap is found', async() => {
            const cwUtils = {
                getNetworkConfigMap: () => null,
            };
            Links.__set__('cwUtils', cwUtils);
            await updateNetworkConfigMap({ })
                .should.eventually.be.rejectedWith(ProjectLinkError)
                .and.have.property('code', ProjectLinkError.CODES.CONFIG_MAP_NOT_FOUND);
        });
    });
    describe('restartDeployment(project)', () => {
        const restartDeployment = Links.__get__('restartDeployment');
        const sandbox = sinon.createSandbox();
        let clock;
        const now = new Date();
        beforeEach(() => {
            clock = sinon.useFakeTimers(now.getTime());
        });
        afterEach(() => {
            sandbox.restore();
            clock.restore();
        });
        it('calls patchProjectDeployments with the correct object to update the \'restartedAt\' date', async() => {
            const cwUtils = {
                patchProjectDeployments: (projectID, patchObj) => {
                    patchObj.should.deep.equal({
                        spec: {
                            template: {
                                metadata: {
                                    annotations: {
                                        'kubectl.kubernetes.io/restartedAt': now.toISOString(),
                                    },
                                },
                            },
                        },
                    });
                    return true;
                },
            };
            Links.__set__('cwUtils', cwUtils);
            await restartDeployment({ projectID: 'projectID' });
        });
        it('throws an error as the project\'s deployment was not found', async() => {
            const cwUtils = {
                patchProjectDeployments: () => null,
            };
            Links.__set__('cwUtils', cwUtils);
            await restartDeployment({ projectID: 'projectID' })
                .should.eventually.be.rejectedWith(ProjectLinkError)
                .and.have.property('code', ProjectLinkError.CODES.DEPLOYMENT_NOT_FOUND);
        });
    });
    describe('checkIfEnvsExistInArray(project, array)', () => {
        const checkIfEnvsExistInArray = Links.__get__('checkIfEnvsExistInArray');
        const arrayOfEnvs = ['env=val', 'env2=val2', 'env3=val3'];
        it('returns true as all the project link envs exist in the given array', () => {
            const links = {
                getEnvPairs: () => ['env=val'],
            };
            checkIfEnvsExistInArray({ links }, arrayOfEnvs).should.be.true;
        });
        it('returns false as only some of the project link envs exist in the given array', () => {
            const links = {
                getEnvPairs: () => ['env=val', 'env20=val20'],
            };
            checkIfEnvsExistInArray({ links }, arrayOfEnvs).should.be.false;
        });
    });
    describe('getDockerContainerEnvs(project)', () => {
        const getDockerContainerEnvs = Links.__get__('getDockerContainerEnvs');
        it('returns an empty array as inspect throws an error', async() => {
            Links.__set__('cwUtils', { inspect: () => { throw new Error(); } });
            const envs = await getDockerContainerEnvs({ projectID: 'projectID' });
            envs.should.deep.equal([]);
        });
        it('returns the environment variables in a container', async() => {
            Links.__set__('cwUtils', { inspect: () => {
                return {
                    Config: {
                        Env: [
                            'env=notval',
                        ],
                    },
                };
            } });
            const envs = await getDockerContainerEnvs({ projectID: 'projectID' });
            envs.should.deep.equal(['env=notval']);
        });
    });
    describe('getKubernetesDeploymentEnvs(project)', () => {
        const getKubernetesDeploymentEnvs = Links.__get__('getKubernetesDeploymentEnvs');
        it('returns an empty array as getProjectDeployments throws an error', async() => {
            Links.__set__('cwUtils', { getProjectDeployments: () => { throw new Error(); } });
            const envs = await getKubernetesDeploymentEnvs({ projectID: 'projectID' });
            envs.should.deep.equal([]);
        });
        it('returns the environment variables in a deployment', async() => {
            Links.__set__('cwUtils', { getProjectDeployments: () => {
                return [{
                    spec: {
                        template: {
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: 'env',
                                                value: 'notval',
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                }];
            } });
            const envs = await getKubernetesDeploymentEnvs({ projectID: 'projectID' });
            envs.should.deep.equal(['env=notval']);
        });
    });
    describe('restartProject(user, project, forceRebuild)', () => {
        const restartProject = Links.__get__('restartProject');
        const sandbox = sinon.createSandbox();
        const mockedUser = {
            restartProject: () => null,
            projectList: {
                retrieveProject: () => true,
            },
            buildProject: () => true,
        };
        const mockedProject = {
            name: null,
            buildStatus: null,
            projectID: null,
            links: {
                getEnvPairs: () => ['env=val'],
            },
        };
        const mockedCwUtils = {
            timeout: () => null,
        };
        describe('RUNNING_IN_K8S === false', () => {
            const originalK8s = global.codewind.RUNNING_IN_K8S;
            before(() => {
                global.codewind.RUNNING_IN_K8S = false;
            });
            after(() => {
                global.codewind.RUNNING_IN_K8S = originalK8s;
            });
            it('does nothing and does not error as the project does not exist', () => {
                const user = {
                    ...mockedUser,
                    projectList: {
                        retrieveProject: () => false,
                    },
                };
                return restartProject(user, mockedProject, false).should.not.be.rejected;
            });
            describe('buildStatus == inProgress or container is not populated', () => {
                const project = {
                    ...mockedProject,
                    buildStatus: 'inProgress',
                };
                afterEach(() => {
                    sandbox.restore();
                });
                it('calls restartDocker once as buildStatus == inProgress', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, inspect: () => true });
                    const spiedRestartFunc = sandbox.spy(() => null);
                    Links.__set__('restartProject', spiedRestartFunc);
                    await restartProject(mockedUser, project, false);
                    spiedRestartFunc.should.be.calledOnce;
                });
                it('calls restartDocker once as container == null', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, inspect: () => {
                        const err = new Error();
                        throw err;
                    } });
                    const spiedRestartFunc = sandbox.spy(() => null);
                    Links.__set__('restartProject', spiedRestartFunc);
                    await restartProject(mockedUser, project, false);
                    spiedRestartFunc.should.be.calledOnce;
                });
            });
            describe('buildStatus != inProgress && container is a populated object', () => {
                const user = {
                    ...mockedUser,
                    buildProject: () => true,
                };
                afterEach(() => {
                    sandbox.restore();
                });
                it('calls user.buildProject once as the linksExistInContainer is false', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, inspect: () => {
                        return {
                            Config: {
                                Env: [
                                    'env=notval',
                                ],
                            },
                        };
                    } });
                    sandbox.spy(user, 'buildProject');
                    await restartProject(user, mockedProject, false);
                    const { buildProject } = user;
                    buildProject.should.be.calledOnce;
                });
                it('calls user.buildProject once as the linksExistInContainer is true', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, inspect: () => {
                        return {
                            Config: {
                                Env: [
                                    'env=val',
                                ],
                            },
                        };
                    } });
                    sandbox.spy(user, 'buildProject');
                    await restartProject(user, mockedProject, false);
                    const { buildProject } = user;
                    buildProject.should.not.be.called;
                });
                it('calls user.buildProject once and does not call checkIfEnvsExistInArray as forceRebuild is true', async() => {
                    // setup
                    const mockedCheckIfEnvsExistInArray = sinon.stub();
                    const resetCwUtils = Links.__set__('cwUtils', { ...mockedCwUtils, inspect: () => {
                        return {
                            Config: {
                                Env: [
                                    'env=val',
                                ],
                            },
                        };
                    } });
                    const resetCheckIfEnvsExistInArray = Links.__set__('checkIfEnvsExistInArray', mockedCheckIfEnvsExistInArray);
                    sandbox.spy(user, 'buildProject');

                    // test
                    await restartProject(user, mockedProject, true);
                    const { buildProject } = user;
                    buildProject.should.be.calledOnce;
                    mockedCheckIfEnvsExistInArray.should.not.be.called;

                    // clean up
                    resetCwUtils();
                    resetCheckIfEnvsExistInArray();
                });
            });
        });
        describe('RUNNING_IN_K8S === true', () => {
            const originalK8s = global.codewind.RUNNING_IN_K8S;
            before(() => {
                global.codewind.RUNNING_IN_K8S = true;
            });
            after(() => {
                global.codewind.RUNNING_IN_K8S = originalK8s;
            });
            it('does nothing and does not error as the project does not exist', () => {
                const user = {
                    ...mockedUser,
                    projectList: {
                        retrieveProject: () => false,
                    },
                };
                return restartProject(user, mockedProject, false).should.not.be.rejected;
            });
            it('calls user.buildProject when the deployment is not found', async() => {
                Links.__set__('cwUtils', { getProjectDeployments: () => { throw new Error(); } });
                const spiedBuildProject = sinon.stub().returns();
                const mockUserWithSpiedBuildProject = {
                    ...mockedUser,
                    buildProject: spiedBuildProject,
                };
                await restartProject(mockUserWithSpiedBuildProject, mockedProject, false).should.be.fulfilled;
                spiedBuildProject.should.be.calledOnce;
            });
            describe('buildStatus == inProgress or deployment in null', () => {
                const project = {
                    ...mockedProject,
                    buildStatus: 'inProgress',
                };
                afterEach(() => {
                    sandbox.restore();
                });
                it('calls restartProject once as buildStatus == inProgress', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, getProjectDeployments: () => [true] });
                    const spiedRestartFunc = sandbox.spy(() => null);
                    Links.__set__('restartProject', spiedRestartFunc);
                    await restartProject(mockedUser, project, false);
                    spiedRestartFunc.should.be.calledOnce;
                });
                it('calls restartProject once as deployment == null (restartExtensionKubernetes throws)', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, getProjectDeployments: () => {
                        const err = new Error();
                        throw err;
                    } });
                    const spiedRestartFunc = sandbox.spy(() => null);
                    Links.__set__('restartProject', spiedRestartFunc);
                    await restartProject(mockedUser, project, false);
                    spiedRestartFunc.should.be.calledOnce;
                });
            });
            describe('buildStatus != inProgress && container is a populated object', () => {
                const user = {
                    ...mockedUser,
                    buildProject: () => true,
                };
                afterEach(() => {
                    sandbox.restore();
                });
                it('calls user.buildProject once as the linksExistInContainer is false', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, getProjectDeployments: () => {
                        return [{
                            spec: {
                                template: {
                                    spec: {
                                        containers: [
                                            {
                                                env: [
                                                    {
                                                        name: 'env',
                                                        value: 'notval',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        }];
                    } });
                    sandbox.spy(user, 'buildProject');
                    await restartProject(user, mockedProject, false);
                    const { buildProject } = user;
                    buildProject.should.be.calledOnce;
                });
                it('calls user.buildProject once as the linksExistInContainer is true', async() => {
                    Links.__set__('cwUtils', { ...mockedCwUtils, getProjectDeployments: () => {
                        return [{
                            spec: {
                                template: {
                                    spec: {
                                        containers: [
                                            {
                                                env: [
                                                    {
                                                        name: 'env',
                                                        value: 'val',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                },
                            },
                        }];
                    } });
                    sandbox.spy(user, 'buildProject');
                    await restartProject(user, mockedProject, false);
                    const { buildProject } = user;
                    buildProject.should.not.be.called;
                });
                it('calls user.buildProject and does not call cwUtils.getProjectDeployments as forceRebuild is true', async() => {
                    const mockedGetProjectDeployments = sinon.stub();
                    Links.__set__('cwUtils', { ...mockedCwUtils, getProjectDeployments: mockedGetProjectDeployments });
                    sandbox.spy(user, 'buildProject');
                    await restartProject(user, mockedProject, true);
                    const { buildProject } = user;
                    buildProject.should.be.calledOnce;
                    mockedGetProjectDeployments.should.not.be.called;
                });
            });
        });
    });
});
