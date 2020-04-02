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
const sinon = require('sinon');

const Links = rewire('../../../../../src/pfe/portal/routes/projects/links.route');
const ProjectLinkError = require('../../../../../src/pfe/portal/modules/utils/errors/ProjectLinkError');
const { suppressLogOutput } = require('../../../../modules/log.service');

chai.should();

describe('links.route.js', () => {
    suppressLogOutput(Links);
    describe('handleRequestError(res, err)', () => {
        const handleRequestError = Links.__get__('handleRequestError');
        [
            { errCode: ProjectLinkError.CODES.INVALID_PARAMETERS, httpCode: 400 },
            { errCode: ProjectLinkError.CODES.NOT_FOUND, httpCode: 404 },
            { errCode: ProjectLinkError.CODES.EXISTS, httpCode: 409 },
        ].forEach(({ errCode, httpCode }) => {
            it(`reports a status of ${httpCode} as the err.code is ${errCode}`, () => {
                const sendStatus = (code) => {
                    code.should.equal(httpCode);
                };
                handleRequestError({ sendStatus }, { code: errCode });
            });
        });
        it('reports a status of 500 as the err.code is unknown', () => {
            const wantedError = {
                code: 'UNKNOWN_ERROR',
            };
            function status(code) {
                code.should.equal(500);
                return this;
            };
            const send = (err) => {
                err.should.equal(wantedError);
            };
            handleRequestError({ status, send }, wantedError);
        });
    });
    describe('verifyTargetProjectExists(user, projectID)', () => {
        const verifyTargetProjectExists = Links.__get__('verifyTargetProjectExists');
        it('throws an error as the project cannot be retrieved', () => {
            const user = {
                projectList: {
                    retrieveProject: () => false,
                },
            };
            (() => verifyTargetProjectExists(user, 'dummyid')).should.throw(ProjectLinkError)
                .and.have.property('code', 'NOT_FOUND');
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
    describe('restartOrBuildProject(user, project)', () => {
        const restartOrBuildProject = Links.__get__('restartOrBuildProject');
        const sandbox = sinon.createSandbox();
        ['nodejs', 'liberty', 'spring'].forEach(projectType => {
            it(`calls restartNodeSpringLiberty as the project type is ${projectType}`, () => {
                const spiedRestartNodeSpringLiberty = sandbox.spy(() => {});
                const spiedRestartDocker = sandbox.spy(() => {});

                Links.__set__('restartNodeSpringLiberty', spiedRestartNodeSpringLiberty);
                Links.__set__('restartDocker', spiedRestartDocker);

                restartOrBuildProject({}, { projectType });

                spiedRestartNodeSpringLiberty.should.be.calledOnce;
                spiedRestartDocker.should.not.be.called;
            });
        });
        ['swift', 'docker', 'appsody', 'anythingelse'].forEach(projectType => {
            it(`calls restartDocker as the project type is ${projectType}`, () => {
                const spiedRestartNodeSpringLiberty = sandbox.spy(() => {});
                const spiedRestartDocker = sandbox.spy(() => {});

                Links.__set__('restartNodeSpringLiberty', spiedRestartNodeSpringLiberty);
                Links.__set__('restartDocker', spiedRestartDocker);

                restartOrBuildProject({}, { projectType });

                spiedRestartNodeSpringLiberty.should.not.be.called;
                spiedRestartDocker.should.be.calledOnce;
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
            ENV_FILE_NAME: 'dummyFileName',
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
    describe('restartDocker(user, project)', () => {
        const restartDocker = Links.__get__('restartDocker');
        const sandbox = sinon.createSandbox();
        const mockedUser = {
            restartProject: () => null,
            projectList: {
                retrieveProject: () => true,
            },
        };
        const mockedProject = {
            name: null,
            buildStatus: null,
            projectID: null,
            links: {
                getEnvPairs: () => ['env=val'],
            },
        };
        it('does nothing and does not error as the project does not exist', () => {
            const user = {
                ...mockedUser,
                projectList: {
                    retrieveProject: () => false,
                },
            };
            return restartDocker(user, mockedProject).should.not.be.rejected;
        });
        it('throws an error as dockerInspect throws an error that does not have a statusCode of 404', () => {
            Links.__set__('dockerInspect', () => { throw new Error(); });
            return restartDocker(mockedUser, mockedProject).should.be.rejected;
        });
        describe('buildStatus == inProgress or container is not populated', () => {
            const project = {
                ...mockedProject,
                buildStatus: 'inProgress',
            };
            beforeEach(() => {
                Links.__set__('cwUtils', { timeout: () => null });
            });
            afterEach(() => {
                sandbox.restore();
            });
            it('calls restartDocker once as buildStatus == inProgress', async() => {
                Links.__set__('dockerInspect', () => true);
                const spiedRestartDocker = sandbox.spy(() => null);
                Links.__set__('restartDocker', spiedRestartDocker);
                await restartDocker(mockedUser, project);
                spiedRestartDocker.should.be.calledOnce;
            });
            it('calls restartDocker once as container == null (dockerInspect throws 404 statusCode)', async() => {
                Links.__set__('dockerInspect', () => {
                    const err = new Error();
                    err.statusCode = 404;
                    throw err;
                });
                const spiedRestartDocker = sandbox.spy(() => null);
                Links.__set__('restartDocker', spiedRestartDocker);
                await restartDocker(mockedUser, project);
                spiedRestartDocker.should.be.calledOnce;
            });
        });
        describe('buildStatus != inProgress && container is a populated object', () => {
            const user = {
                ...mockedUser,
                buildAndRunProject: () => true,
            };
            afterEach(() => {
                sandbox.restore();
            });
            it('calls user.buildAndRunProject once as the linksExistInContainer is false', async() => {
                Links.__set__('dockerInspect', () => {
                    return {
                        Config: {
                            Env: [
                                'env=notval',
                            ],
                        },
                    };
                });
                sandbox.spy(user, 'buildAndRunProject');
                await restartDocker(user, mockedProject);
                const { buildAndRunProject } = user;
                buildAndRunProject.should.be.calledOnce;
            });
            it('calls user.buildAndRunProject once as the linksExistInContainer is true', async() => {
                Links.__set__('dockerInspect', () => {
                    return {
                        Config: {
                            Env: [
                                'env=val',
                            ],
                        },
                    };
                });
                sandbox.spy(user, 'buildAndRunProject');
                await restartDocker(user, mockedProject);
                const { buildAndRunProject } = user;
                buildAndRunProject.should.not.be.called;
            });
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
});
