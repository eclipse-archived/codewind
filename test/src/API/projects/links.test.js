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
const chai = require('chai');
const path = require('path');
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const { testTimeout, TEMP_TEST_DIR, pathToApiSpec } = require('../../../config');
const ProjectLinkError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectLinkError');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Link tests (/api/v1/project/:id/links)', () => {
    const nodeProjectName = `test-project-links-nodejs-${Date.now()}`;
    const goProjectName = `test-project-links-go-${Date.now()}`;
    const pathToNodeProject = path.join(TEMP_TEST_DIR, nodeProjectName);
    const pathToGoProject = path.join(TEMP_TEST_DIR, goProjectName);
    let projectID;
    // Target ID must have started for these tests to pass
    let targetProjectID;

    before('create a sample Node.js and Go project and bind to Codewind and wait for the Go project to start', async function() {
        this.timeout(testTimeout.maxTravis);
        // Use GO applications as these tests require two running applications
        projectID = await projectService.createProjectFromTemplate(nodeProjectName, 'nodejs', pathToNodeProject);
        targetProjectID = await projectService.createProjectFromTemplate(goProjectName, 'go', pathToGoProject, true);
        await projectService.awaitProjectStartedHTTP(targetProjectID);
    });

    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToNodeProject, projectID);
        await projectService.removeProject(pathToGoProject, targetProjectID);
    });

    describe('GET', function() {
        it('returns an empty array as the project\'s links object is empty', async function() {
            const body = await projectService.getProjectLinks(projectID);
            body.length.should.equal(0);
        });
    });
    describe('POST', function() {
        it('adds a link to a project but throws an error as the targetProject container has not started', async function() {
            const res = await projectService.addProjectLink(targetProjectID, projectID, 'ENVNAME');
            res.should.have.status(404);
            const { body: { code } } = res;
            code.should.equal(ProjectLinkError.CODES.CONTAINER_NOT_FOUND);
        });
        it('fails to add a link as the targetProjectID does not exist', async function() {
            const res = await projectService.addProjectLink(projectID, '00000000-0000-11ea-aaba-d5e958b858e9', 'ENVNAME');
            res.should.have.status(404);
            const { body: { code } } = res;
            code.should.equal(ProjectLinkError.CODES.NOT_FOUND);
        });
        it('fails to add a link as the request does not contain the required fields', async function() {
            const res = await projectService.addProjectLink(projectID, targetProjectID, null);
            res.should.have.status(400);
        });
        it('fails to add a link as the request envName is a blank string', async function() {
            const res = await projectService.addProjectLink(projectID, targetProjectID, '');
            res.should.have.status(400);
        });
        describe('add a duplicate envName', function() {
            const duplicateEnvName = 'DUPE_ENV_VALUE';
            before(async function() {
                const res = await projectService.addProjectLink(projectID, targetProjectID, duplicateEnvName, 'urlthatdoesntoexist', 'nonexistantpfeurl');
                res.should.have.status(202);
            });
            it('fails to add a link with an envName that already exists', async function() {
                const res = await projectService.addProjectLink(projectID, targetProjectID, duplicateEnvName, 'anotherurl', 'anothernonexistantpfeurl');
                res.should.have.status(409);
            });
        });
    });
    describe('PUT', function() {
        it('returns 404 as the link does not exist', async function() {
            const res = await projectService.updateProjectLink(projectID, 'doesnotexist');
            res.should.have.status(404);
            const { body: { code } } = res;
            code.should.equal(ProjectLinkError.CODES.NOT_FOUND);
        });
        describe('updates a link', function() {
            const envName = 'UPDATE_LINK';
            before(async function() {
                const res = await projectService.addProjectLink(projectID, targetProjectID, envName, 'urlthatdoesntoexist', 'nonexistantpfeurl');
                res.should.have.status(202);
            });
            it('returns 202 as the link has been updated', async function() {
                const res = await projectService.updateProjectLink(projectID, envName, 'NEW_ENV_NAME');
                res.should.have.status(202);

                const body = await projectService.getProjectLinks(projectID);
                const oldEnvExists = body.findIndex(({ envName: existingEnv }) => existingEnv === envName);
                oldEnvExists.should.be.equal(-1);

                const updatedEnvExists = body.findIndex(({ envName: existingEnv }) => existingEnv === 'NEW_ENV_NAME');
                updatedEnvExists.should.be.gt(-1);
            });
        });
    });
    describe('DELETE', function() {
        it('returns 404 as the link does not exist', async function() {
            const res = await projectService.deleteProjectLink(projectID, 'doesnotexist');
            res.should.have.status(404);
            const { body: { code } } = res;
            code.should.equal(ProjectLinkError.CODES.NOT_FOUND);
        });
        describe('delete a link', function() {
            const envName = 'DELETE_LINK';
            before(async function() {
                const res = await projectService.addProjectLink(projectID, targetProjectID, envName, 'urlthatdoesntoexist', 'nonexistantpfeurl');
                res.should.have.status(202);
            });
            it('returns 202 as the link has been deleted', async function() {
                const res = await projectService.deleteProjectLink(projectID, envName);
                res.should.have.status(202);
            });
        });
    });
});
