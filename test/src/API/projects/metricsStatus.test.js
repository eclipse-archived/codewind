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
} = require('../../../config');

chai.should();

describe('Metrics Status tests (/projects/{id}/metrics/status)', function() {        
    it('returns 400 when the project does not exist', async function() {
        this.timeout(testTimeout.short);
        const res = await getMetricsStatus('invalidId');
        res.should.have.status(404);
    });

    describe('Node.js project', function() {
        const testResourcesDir = path.join('.', 'resources', 'nodeProjectFilesWithoutAppmetricsDash');
        const serverJsWithoutAppmetricsDash = fs.readFileSync(path.join(testResourcesDir, 'serverJs'));
        const packageJsonWithoutAppmetricsDash = fs.readJsonSync(path.join(testResourcesDir, 'package.json'));

        const projectName = `test-node-project-metrics-status-${Date.now()}`;
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

        it('returns 200 and { metricsAvailable: true } when the project has appmetrics-dash', async function() {
            this.timeout(testTimeout.short);
            const res = await getMetricsStatus(projectID);
            res.should.have.status(200);
            res.body.metricsAvailable.should.be.true;

            const { body: project } = await projectService.getProject(projectID);
            project.metricsAvailable.should.be.true;
        });

        it('returns 200 and { metricsAvailable: false } when project does not have appmetrics-dash', async function() {
            this.timeout(testTimeout.med);
            
            const pathToPackageJson = path.join(pathToLocalProject, 'package.json');
            const pathToServerJs = path.join(pathToLocalProject, 'server', 'server.js');

            // remove appmetrics-dash from package.json and server.js
            fs.writeJSONSync(pathToPackageJson, packageJsonWithoutAppmetricsDash, { spaces: 2 });
            fs.writeFileSync(pathToServerJs, serverJsWithoutAppmetricsDash);
            
            // sync project
            const resToSync = await projectService.syncFiles(
                projectID,
                pathToLocalProject,
                ['package.json', 'server/server.js'],
                projectService.defaultNodeProjectFileList,
                projectService.defaultNodeProjectDirList,
            );
            resToSync.should.have.status(200);

            // check metrics status
            const resToGetMetricsStatus = await getMetricsStatus(projectID);
            resToGetMetricsStatus.should.have.status(200);
            resToGetMetricsStatus.body.metricsAvailable.should.be.false;

            const { body: project } = await projectService.getProject(projectID);
            project.metricsAvailable.should.be.false;
        });

        it('returns 400 when the project does not have a package.json', async function() {
            this.timeout(testTimeout.med);
            
            // ensure server.js does not use appmetrics-dash
            const pathToServerJs = path.join(pathToLocalProject, 'server', 'server.js');
            fs.writeFileSync(pathToServerJs, serverJsWithoutAppmetricsDash);
            
            // sync project
            const resToSync = await projectService.syncFiles(
                projectID,
                pathToLocalProject,
                ['server/server.js'],
                projectService.defaultNodeProjectFileList.filter(file => file !== 'package.json'), // removes package.json from project
                projectService.defaultNodeProjectDirList,
            );
            
            resToSync.should.have.status(400);
            resToSync.body.should.deep.equal({
                name: 'MetricsStatusError',
                code: 'BUILD_FILE_MISSING',
                message: ' Cannot find project build-file (package.json)',
            });

            const resToGetMetricsStatus = await getMetricsStatus(projectID);
            resToGetMetricsStatus.should.have.status(400);
            resToGetMetricsStatus.body.should.deep.equal({
                name: 'MetricsStatusError',
                code: 'BUILD_FILE_MISSING',
                message: ' Cannot find project build-file (package.json)',
            });

            const { body: project } = await projectService.getProject(projectID);
            project.metricsAvailable.should.be.false;
        });
    });

    describe('Java Liberty project', function() {
        const projectName = `test-liberty-project-metrics-status-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'liberty', pathToLocalProject); 
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and { metricsAvailable: true } when the project has just been created', async function() {
            this.timeout(testTimeout.short);
            const res = await getMetricsStatus(projectID);
            res.should.have.status(200);
            res.body.metricsAvailable.should.be.true;

            const { body: project } = await projectService.getProject(projectID);
            project.metricsAvailable.should.be.true;
        });
    });

    describe('Java Open Liberty project', function() {
        const projectName = `test-liberty-project-metrics-status-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'openliberty', pathToLocalProject); 
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and { metricsAvailable: false } when the project has just been created', async function() {
            this.timeout(testTimeout.short);
            const res = await getMetricsStatus(projectID);
            res.should.have.status(200);
            res.body.metricsAvailable.should.be.false;

            const { body: project } = await projectService.getProject(projectID);
            project.metricsAvailable.should.be.false;
        });
    });
});

function getMetricsStatus(projectID) {
    return reqService.chai
        .get(`/api/v1/projects/${projectID}/metrics/status`)
        .set('cookie', ADMIN_COOKIE);
}
