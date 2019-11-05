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
const {promisify} = require('util');
const execAsync = promisify(require('child_process').exec);
const path = require('path');

const containerService = require('../../../modules/container.service');
const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');

const { ADMIN_COOKIE, WORKSPACE_DIR, testTimeout, containerDir } = require('../../../config');
chai.should();

function setUpProjectBindOptions() {
    const generateOptions = [
        {
            projectType: 'liberty',
            language: 'java',
            gitUrl: 'https://github.com/microclimate-dev2ops/javaMicroProfileTemplate.git',
        },
        {
            projectType: 'spring',
            language: 'java',
            gitUrl: 'https://github.com/microclimate-dev2ops/springJavaTemplate.git',
        },
        {
            projectType: 'nodejs',
            language: 'nodejs',
            gitUrl: 'https://github.com/microclimate-dev2ops/microclimateNodeTemplate.git',
        },
        {
            projectType: 'swift',
            language: 'swift',
            gitUrl: 'https://github.com/microclimate-dev2ops/swiftTemplate.git',
        },
    ];

    for (const options of generateOptions) {
        // Make the project and folder names different.
        options.name = `${options.projectType}_bind_test_${Date.now()}`;
        options.folder = `${options.projectType}bind${Date.now()}`;
    }
    return generateOptions;
}

/** NOTE: Until file watcher is updated these tests need to
 *  create the project to be bound under codewind-workspace,
 *  after it is updated we need to stop doing that.
 */
let workspace_location;

describe('Bind Tests', function() {
    before(async function() {
        workspace_location = await projectService.findWorkspaceLocation();
        await containerService.ensureDir(containerDir);
    });

    describe('Invalid/missing parameters', function() {
        it("should fail (with status 400) when we don't supply a project name",  async function() {
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({projectType: 'nodejs', language: 'nodejs', path: '/an/absolute/path'});
            res.should.have.status(400);
        });

        it("should fail (with status 400) when we don't supply a path", async function() {
            this.timeout(testTimeout.med);
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({name: 'nopath', projectType: 'nodejs', language: 'nodejs'});
            res.should.have.status(400);
        });

        it("should fail (with status 400) when we don't supply a language", async function() {
            this.timeout(testTimeout.med);
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({name: 'nolanguage', projectType: 'nodejs', path: '/an/absolute/path'});
            res.should.have.status(400);
        });

        it("should fail (with status 400) when we don't specify a project type for a project",  async function() {
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({name: 'projectTypefornode', language: 'nodejs', path: '/an/absolute/path'});
            res.should.have.status(400);
        });

        it("should fail (with status 400) when we don't specify a project type for a java project", async function() {
            this.timeout(testTimeout.med);
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({name: 'noprojecttype', language: 'java', path: '/an/absolute/path'});
            res.should.have.status(400);
        });

        it('should fail (with status 400) when we specify an invalid project type for a project', async function() {
            this.timeout(testTimeout.med);
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({name: 'badprojecttype', language: 'java', projectType: 'ant', path: '/an/absolute/path'});
            res.should.have.status(400);
        });

        it('should fail (with status 400) when we specify a project name with an illegal character', async function() {
            this.timeout(testTimeout.med);
            const res = await reqService.chai
                .post('/api/v1/projects/bind')
                .set('cookie', ADMIN_COOKIE)
                .send({name: '&isnotallowed', language: 'nodejs', projectType: 'nodejs', autoBuild: false, path: '/an/absolute/path'});
            res.should.have.status(400);
            res.body.message.should.equal('Project name is invalid: invalid characters : ["&"]');
        });
    });

    describe('Bind various types of projects', function() {
        const projects = setUpProjectBindOptions();
        for (const project of projects) testBind(project);
    });
});

function testBind(project) {
    describe(`${project.projectType} (${project.name})`, function() {
        let projectID;

        describe('Bind from folder', function() {

            before(async function() {
                this.timeout(testTimeout.med);
                await projectService.cloneProject(project.gitUrl, path.join(workspace_location, project.folder));
            });

            after(async function() {
                this.timeout(2 * testTimeout.med);
                await execAsync(`rm -rf ${workspace_location}/${project.folder}`);
            });

            it('should bind a project', async function() {
                this.timeout(testTimeout.med);
                const options = {
                    name: project.name,
                    path: `${workspace_location}/${project.folder}`,
                    language: project.language,
                    projectType: project.projectType,
                    autoBuild: false,
                };
                const res = await projectService.bindProject(options);
                res.should.have.status(202);
                projectID = res.body.projectID;
            });

            it(`${project.name} should be in the project list`, async function() {
                this.timeout(testTimeout.med);
                const projectObject = await projectService.getProject(projectID);
                projectObject.projectID.should.equal(projectID);
            });

            it("should have created a 'projectID'.inf file", async function() {
                this.timeout(testTimeout.med);
                const projectInf = await containerService.awaitProjectInfFile(projectID);
                projectInf.projectID.should.be.a('string');
            });

            it('should return bound project in project list', async function() {
                this.timeout(testTimeout.med);
                const projectObject = await projectService.getProject(projectID);
                projectObject.should.be.an('object');
                projectObject.language.should.equal(project.language);
            });

            it('should fail with (status 400) when a bind is requested to a relative path', async function() {
                this.timeout(testTimeout.med);
                const res = await projectService.bindProject({
                    name: project.name,
                    path: '../fakedirectory',
                    language: project.language,
                }, 400);
                res.should.have.status(400);
            });

            it('should fail with (status 400) when an bind is requested without a name', async function() {
                this.timeout(testTimeout.med);
                const res = await projectService.bindProject({
                    path: `${workspace_location}/${project.folder}`,
                    language: project.language,
                }, 400);
                res.should.have.status(400);
            });

            it('should fail with (status 409) when an bind is requested with the same project name', async function() {
                this.timeout(testTimeout.med);
                const res = await projectService.bindProject({
                    name: project.name,
                    path: `${workspace_location}/fakedirectory`,
                    language: project.language,
                    projectType : project.projectType,
                    autoBuild: false,
                }, 409);
                res.should.have.status(409);
            });

            it('should fail with (status 409) when an bind is requested with the same project path', async function() {
                this.timeout(testTimeout.med);
                const res = await projectService.bindProject({
                    name: `${project.name}2`,
                    path: `${workspace_location}/${project.folder}`,
                    language: project.language,
                    projectType : project.projectType,
                    autoBuild: false,
                }, 409);
                res.should.have.status(409);
            });

            it('should unbind a project', async function() {
                this.timeout(testTimeout.med);
                const res = await projectService.unbindProject(projectID);
                res.should.have.status(202);
            });

            it('should ensure the project inf has been deleted', async function() {
                this.timeout(testTimeout.short);
                await checkProjectInfExists(project.name, false);
            });
        });
    });
}

async function checkProjectInfExists(projectName, shouldExist) {
    const path = `${WORKSPACE_DIR}/.projects/${projectName}.inf`;
    (await containerService.fileExists(path)).should.equal(shouldExist);
}
