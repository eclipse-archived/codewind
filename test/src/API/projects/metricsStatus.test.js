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
const fs = require('fs-extra');
const path = require('path');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const { 
    ADMIN_COOKIE,
    TEMP_TEST_DIR,
    testTimeout,
    templateOptions,
} = require('../../../config');

chai.should();

describe('Metrics Status tests (/projects/{id}/metrics/status)', function() {        
    it('returns 400 when the project does not exist', async function() {
        this.timeout(testTimeout.short);

        const res = await getMetricsStatus('invalidId');
        res.should.have.status(404);
    });

    describe('Node.js project with appmetrics-dash', function() {
        const projectName = `test-node-project-metrics-app-dash-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('git clone project to disk', async function() {
            this.timeout(testTimeout.med);
            await projectService.cloneProject(
                templateOptions['nodejs'].url,
                pathToLocalProject,
            );
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and { metricsAvailable: true } when binding project to Codewind', async function() {
            this.timeout(testTimeout.med);

            const { body: project } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'nodejs',
                projectType: 'nodejs',
                creationTime: Date.now(),
            });
            project.metricsAvailable.should.be.true;

            const res = await getMetricsStatus(project.projectID);
            res.should.have.status(200);
            res.body.metricsAvailable.should.be.true;

            // save projectID for cleanup
            projectID = project.projectID;
        });
    });

    describe('Node.js project without appmetrics-dash', function() {
        const projectName = `test-node-project-metrics-no-app-dash-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('git clone project to disk and remove appmetrics-dash from package.json and server.js', async function() {
            this.timeout(testTimeout.med);
            await projectService.cloneProject(
                templateOptions['nodejs'].url,
                pathToLocalProject,
            );

            const filesWithoutAppmetricsDash = path.join('.', 'resources', 'nodeProjectFilesWithoutAppmetricsDash');
            fs.copySync(
                path.join(filesWithoutAppmetricsDash, 'package.json'),
                path.join(pathToLocalProject, 'package.json')
            );
            fs.copySync(
                path.join(filesWithoutAppmetricsDash, 'serverJs'),
                path.join(pathToLocalProject, 'server', 'server.js'),
            );
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and { metricsAvailable: true } when binding project to Codewind', async function() {
            this.timeout(testTimeout.med);

            const { body: project } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'nodejs',
                projectType: 'nodejs',
                creationTime: Date.now(),
            });
            project.metricsAvailable.should.be.false;

            const res = await getMetricsStatus(project.projectID);
            res.should.have.status(200);
            res.body.metricsAvailable.should.be.false;

            // save projectID for cleanup
            projectID = project.projectID;
        });
    });

    describe('Node.js project without package.json', function() {
        const projectName = `test-node-project-metrics-no-package-json-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);

        before('git clone project to disk and remove package.json', async function() {
            this.timeout(testTimeout.med);
            await projectService.unbindAllProjects();
            await projectService.cloneProject(
                templateOptions['nodejs'].url,
                pathToLocalProject,
            );
            
            const pathToPackageJson = path.join(pathToLocalProject, 'package.json');
            fs.removeSync(pathToPackageJson);
        });

        it('returns 400 and fails to bind project to Codewind', async function() {
            this.timeout(testTimeout.med);

            const resToBind = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'nodejs',
                projectType: 'nodejs',
                creationTime: Date.now(),
            });
            resToBind.should.have.status(400);
            resToBind.should.satisfyApiSpec;
            resToBind.body.should.deep.equal({
                name: 'MetricsStatusError',
                code: 'BUILD_FILE_MISSING',
                message: ' Cannot find project build-file (package.json)',
            });
        });
    });

});

function getMetricsStatus(projectID) {
    return reqService.chai
        .get(`/api/v1/projects/${projectID}/metrics/status`)
        .set('cookie', ADMIN_COOKIE);
}
