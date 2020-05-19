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
const fs = require('fs-extra');
const chaiSubset = require('chai-subset');
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const {
    ADMIN_COOKIE,
    TEMP_TEST_DIR,
    testTimeout,
    pathToApiSpec,
    templateOptions,
} = require('../../../config');
const { findFile } = require('../../../../src/pfe/portal/modules/utils/sharedFunctions');

chai.use(chaiSubset);
chai.use(chaiResValidator(pathToApiSpec));
chai.should();

const postMetricsAuth = (projectID, options) => reqService.chai
    .post(`/api/v1/projects/${projectID}/metrics/auth`)
    .set('Cookie', ADMIN_COOKIE)
    .send(options);

describe('Metrics Auth tests (/api/v1/projects/{id}/metrics/auth)', function() {
    it('returns 404 to /metrics/auth when project does not exist', async function() {
        const projectID = '00000000-0000-0000-0000-000000000000';
        this.timeout(testTimeout.short);
        const res = await postMetricsAuth(projectID, { disable: true });

        res.status.should.equal(404, res.text); // print res.text if assertion fails
        res.text.should.equal(`Project with ID \'${projectID}\' does not exist on the Codewind server`);
    });

    describe('Disables and enables the metrics authentication of an open-liberty application (These tests require the previous ones to pass)', function() {
        const projectName = `test-open-liberty-metrics-auth-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('create a sample project, bind to Codewind (without building) and update its metrics status', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'openliberty', pathToLocalProject);
            const { body: { microprofilePackageFoundInBuildFile, microprofilePackageAuthenticationDisabled } } = await projectService.getMetricsStatus(projectID);
            microprofilePackageFoundInBuildFile.should.be.true;
            microprofilePackageAuthenticationDisabled.should.be.false;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            if (projectID) await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 202 to /metrics/auth and adds the disable metrics authentication file into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: true });
            res.status.should.equal(202, res.text); // print res.text if assertion fails
        });

        it('returns 400 to /metrics/auth as the metrics authentication is already disabled', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: true });
            res.status.should.equal(400, res.text); // print res.text if assertion fails
        });

        it('reports the microprofilePackageAuthenticationDisabled as true as the metrics auth has been disabled', async function() {
            const { body: { microprofilePackageAuthenticationDisabled } } = await projectService.getMetricsStatus(projectID);
            microprofilePackageAuthenticationDisabled.should.be.true;
        });

        it('returns 202 to /metrics/auth and removes the disable metrics authentication file into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: false });
            res.status.should.equal(202, res.text); // print res.text if assertion fails
        });

        it('returns 400 to /metrics/auth and as metrics auth is not disabled', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: false });
            res.status.should.equal(400, res.text); // print res.text if assertion fails
        });

        it('reports the microprofilePackageAuthenticationDisabled as false as the metrics auth has been enabled', async function() {
            const { body: { microprofilePackageAuthenticationDisabled } } = await projectService.getMetricsStatus(projectID);
            microprofilePackageAuthenticationDisabled.should.be.false;
        });
    });
    describe('Returns 500 as the project does not contain a server.xml (but is a Java project)', function() {
        const projectName = `test-websphere-liberty-metrics-auth-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            // projectID = await projectService.createProjectFromTemplate(projectName, 'lagom', pathToLocalProject);
            const { url, language } = templateOptions['openliberty'];
            await projectService.cloneProject(url, pathToLocalProject);

            // Remove server.xml for this test
            const serverXMLLocation = await findFile('server.xml', pathToLocalProject);
            await fs.remove(serverXMLLocation);

            const { body } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language,
                projectType: 'docker',
                autoBuild: false,
                creationTime: Date.now(),
            });
            projectID = body.projectID;

            const { body: { microprofilePackageFoundInBuildFile } } = await projectService.getMetricsStatus(projectID);
            microprofilePackageFoundInBuildFile.should.be.true;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            if (projectID) await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 500 to /metrics/auth as the project does not contain a server.xml', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: true });
            res.status.should.equal(500, res.text); // print res.text if assertion fails
        });
    });
    describe('Returns 400 as the project language is nodejs which does not have microprofile metrics (and is not supported)', function() {
        const projectName = `test-nodejs-metrics-auth-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
            const { body: { microprofilePackageFoundInBuildFile } } = await projectService.getMetricsStatus(projectID);
            microprofilePackageFoundInBuildFile.should.be.false;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            if (projectID) await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 400 to /metrics/auth as the project does not have microprofile metrics', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: true });
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.equal(`Disabling of Microprofile metrics authentication is not supported for projects of language \'${projectID}\'\nProject does not have microprofile metrics`);
        });

        it('returns 400 to /metrics/auth as the project does not have microprofile metrics', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: false });
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.equal(`Disabling of Microprofile metrics authentication is not supported for projects of language \'${projectID}\'\nProject does not have microprofile metrics`);
        });
    });
});
