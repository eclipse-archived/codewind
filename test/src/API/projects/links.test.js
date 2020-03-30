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

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Link tests (/api/v1/project/:id/links)', () => {
    const nodeProjectName = `test-project-links-nodejs-${Date.now()}`;
    const goProjectName = `test-project-links-go-${Date.now()}`;
    const pathToNodeProject = path.join(TEMP_TEST_DIR, nodeProjectName);
    const pathToGoProject = path.join(TEMP_TEST_DIR, goProjectName);
    let projectIDForNodeApp;
    let projectIDForGenericDocker;

    before('create a sample Node.js and Go project and bind to Codewind, without building', async function() {
        this.timeout(testTimeout.med);
        projectIDForNodeApp = await projectService.createProjectFromTemplate(nodeProjectName, 'nodejs', pathToNodeProject);
        projectIDForGenericDocker = await projectService.createProjectFromTemplate(goProjectName, 'go', pathToGoProject);
    });

    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToNodeProject, projectIDForNodeApp);
        await projectService.removeProject(pathToGoProject, projectIDForGenericDocker);
    });

    describe('GET', function() {
        it('returns an empty array as the project\'s links object is empty', async function() {
            const body = await projectService.getProjectLinks(projectIDForNodeApp);
            body.length.should.equal(0);
        });
    });
    describe('POST', function() {
        it('adds a link to a non-local project (located on different PFEs)', async function() {
            const res = await projectService.addProjectLink(projectIDForGenericDocker, projectIDForNodeApp, 'ENVNAME', 'urlthatdoesntoexist', 'nonexistantpfeurl');
            res.should.have.status(200);
            res.should.have.ownProperty('body');
            const { body } = res;
            body.should.be.an('array');
            body.length.should.equal(1);
        });
        it('adds a link to a local project (located on the same PFE)', async function() {
            const res = await projectService.addProjectLink(projectIDForNodeApp, projectIDForGenericDocker, 'ENVNAME');
            res.should.have.status(200);
            res.should.have.ownProperty('body');
            const { body } = res;
            body.should.be.an('array');
            body.length.should.equal(1);
        });
        it('fails to add a link as the request does not contain the required fields', async function() {
            const res = await projectService.addProjectLink(projectIDForNodeApp, projectIDForGenericDocker, null);
            res.should.have.status(400);
        });
        it('fails to add a link as the request envName is a blank string', async function() {
            const res = await projectService.addProjectLink(projectIDForNodeApp, projectIDForGenericDocker, '', 'urlthatdoesntoexist', 'nonexistantpfeurl');
            res.should.have.status(400);
        });
        it('fails to add a link as the targetProjectPFEURL field is populated but the targetProjectURL field is not (non-local validation test)', async function() {
            const res = await projectService.addProjectLink(projectIDForNodeApp, projectIDForGenericDocker, '', null, 'nonexistantpfeurl');
            res.should.have.status(400);
        });
        describe('add a duplicate envName', function() {
            const duplicateEnvName = 'DUPE_ENV_VALUE';
            before(async function() {
                const res = await projectService.addProjectLink(projectIDForGenericDocker, projectIDForNodeApp, duplicateEnvName, 'urlthatdoesntoexist', 'nonexistantpfeurl');
                res.should.have.status(200);
            });
            it('fails to add a link with an envName that already exists', async function() {
                const res = await projectService.addProjectLink(projectIDForGenericDocker, projectIDForNodeApp, duplicateEnvName, 'anotherurl', 'anothernonexistantpfeurl');
                res.should.have.status(409);
            });
        });
    });
    describe('PUT', function() {
        it('returns 404 as the link does not exist', async function() {
            const res = await projectService.updateProjectLink(projectIDForNodeApp, 'doesnotexist');
            res.should.have.status(404);
        });
        describe('updates a link', function() {
            const envName = 'UPDATE_LINK';
            before(async function() {
                const res = await projectService.addProjectLink(projectIDForGenericDocker, projectIDForNodeApp, envName, 'urlthatdoesntoexist', 'nonexistantpfeurl');
                res.should.have.status(200);
                const { body } = res;
                const envExistsInLinks = body.findIndex(({ envName: existingEnv }) => existingEnv === envName);
                envExistsInLinks.should.be.gt(-1);
            });
            it('returns 204 as the link has been updated', async function() {
                const res = await projectService.updateProjectLink(projectIDForGenericDocker, envName, 'NEW_ENV_NAME');
                res.should.have.status(204);

                const body = await projectService.getProjectLinks(projectIDForGenericDocker);
                const oldEnvExists = body.findIndex(({ envName: existingEnv }) => existingEnv === envName);
                oldEnvExists.should.be.equal(-1);

                const updatedEnvExists = body.findIndex(({ envName: existingEnv }) => existingEnv === 'NEW_ENV_NAME');
                updatedEnvExists.should.be.gt(-1);
            });
        });
    });
    describe('DELETE', function() {
        it('returns 404 as the link does not exist', async function() {
            const res = await projectService.deleteProjectLink(projectIDForNodeApp, 'doesnotexist');
            res.should.have.status(404);
        });
        describe('delete a link', function() {
            const envName = 'DELETE_LINK';
            before(async function() {
                const res = await projectService.addProjectLink(projectIDForGenericDocker, projectIDForNodeApp, envName, 'urlthatdoesntoexist', 'nonexistantpfeurl');
                res.should.have.status(200);
            });
            it('returns 204 as the link has been deleted', async function() {
                const res = await projectService.deleteProjectLink(projectIDForGenericDocker, envName);
                res.should.have.status(204);
            });
        });
    });
});
