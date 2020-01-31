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
const path = require('path');
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const { 
    testTimeout,
    TEMP_TEST_DIR,
    pathToApiSpec,
} = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Open/Close Project Tests', function() {
    const projectName = `test-open-close-project-${Date.now()}`;
    const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
    let projectID;

    before('create a sample project and bind to Codewind, without building', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
    });

    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToLocalProject, projectID);
    });

    describe('PUT projects/{id}/close', function() {
        it('returns 202 when the project is open', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.closeProject(projectID);
            
            res.should.have.status(202);
            res.should.satisfyApiSpec;
            res.body.msg.should.equal(`Now trying to close project ${projectName} (${projectID})`); 
        });

        it('returns 409 when the project is closing', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.closeProject(projectID);
            
            res.should.have.status(409);
            res.should.satisfyApiSpec;
            res.body.msg.should.include('Already closing'); 
        });

        it('returns 404 when the project does not exist', async function() {
            this.timeout(testTimeout.short);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const res = await projectService.closeProject(idMatchingNoProjects);
            
            res.should.have.status(404);
            res.should.satisfyApiSpec;
            res.body.msg.should.equal(`Unable to find project ${idMatchingNoProjects}`);
        });
    });

    describe('PUT projects/{id}/open', function() {
        it('returns 200 when the project is closing or closed', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.openProject(projectID);
            
            res.should.have.status(200);
            res.should.satisfyApiSpec;
            res.text.should.equal(`Project ${projectName} (${projectID}) opened. Will now build and run it`);
        });

        it('returns 200 when the project is opening', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.openProject(projectID);
            
            res.should.have.status(200);
            res.should.satisfyApiSpec;
            res.text.should.equal(`Project ${projectName} (${projectID}) opened. Will now build and run it`);
        });

        it('returns 404 when the project does not exist', async function() {
            this.timeout(testTimeout.short);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const res = await projectService.openProject(idMatchingNoProjects);
            
            res.should.have.status(404);
            res.should.satisfyApiSpec;
            res.text.should.equal(`Unable to find project ${idMatchingNoProjects}`);
        });
    });
});
