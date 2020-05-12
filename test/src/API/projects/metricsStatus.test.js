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
const chaiSubset = require('chai-subset');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const {
    ADMIN_COOKIE,
    TEMP_TEST_DIR,
    testTimeout,
    templateOptions,
} = require('../../../config');

chai.should();
chai.use(chaiSubset);

describe('Metrics Status tests (/projects/{id}/metrics/status)', function() {
    it('returns 400 when the project does not exist', async function() {
        this.timeout(testTimeout.short);

        const res = await getMetricsStatus('invalidId');
        res.status.should.equal(404, res.text);
    });

    describe('Node.js project with appmetrics-dash', function() {
        const projectName = `test-node-project-metrics-app-dash-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('clone project and bind to PFE', async function() {
            this.timeout(testTimeout.med);
            await projectService.cloneProject(
                templateOptions['nodejs'].url,
                pathToLocalProject,
            );

            const { body: project } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'nodejs',
                projectType: 'nodejs',
                creationTime: Date.now(),
            });
            projectID = project.projectID;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and correct metrics information before the project is running', async function() {
            this.timeout(testTimeout.med);
            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.deep.equal({
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                microprofilePackageFoundInBuildFile: false,
                appmetricsPackageFoundInBuildFile: true,
                canMetricsBeInjected: true,
                projectRunning: false,
                hasTimedMetrics: false,
            });
        });

        it('returns 200 and the correct metrics information when the project is running', async function() {
            if (process.env.JENKINS_HOME) {
                this.skip();
            }
            this.timeout(testTimeout.med);
            await projectService.awaitProjectStartedHTTP(projectID);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.containSubset({
                liveMetricsAvailable: true,
                metricsEndpoint: false,
                appmetricsEndpoint: '/appmetrics-dash',
                projectRunning: true,
            });
        });
    });

    describe('Node.js project without appmetrics-dash', function() {
        const projectName = `test-node-project-metrics-no-app-dash-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('clone project, remove appmetrics-dash and bind to PFE', async function() {
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

            const { body: project } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'nodejs',
                projectType: 'nodejs',
                creationTime: Date.now(),
            });
            projectID = project.projectID;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and correct metrics information before the project is running', async function() {
            this.timeout(testTimeout.med);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.deep.equal({
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                microprofilePackageFoundInBuildFile: false,
                appmetricsPackageFoundInBuildFile: false,
                canMetricsBeInjected: true,
                projectRunning: false,
                hasTimedMetrics: false,
            });
        });

        it('returns 200 and the correct metrics information when the project is running', async function() {
            if (process.env.JENKINS_HOME) {
                this.skip();
            }
            this.timeout(testTimeout.med);
            await projectService.awaitProjectStartedHTTP(projectID);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.containSubset({
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                projectRunning: true,
            });
        });
    });

    describe('Java Liberty project with javametrics-dash', function() {
        const projectName = `test-liberty-project-metrics-java-dash-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('clone project and bind to PFE', async function() {
            this.timeout(testTimeout.med);
            await projectService.cloneProjectAndReplacePlaceholders(
                templateOptions['liberty'].url,
                pathToLocalProject,
                projectName,
            );
            const { body: project } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'java',
                projectType: 'liberty',
                creationTime: Date.now(),
            });
            projectID = project.projectID;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and correct metrics information before the project is running', async function() {
            this.timeout(testTimeout.med);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.deep.equal({
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                microprofilePackageFoundInBuildFile: true,
                appmetricsPackageFoundInBuildFile: true,
                canMetricsBeInjected: true,
                projectRunning: false,
                hasTimedMetrics: false,
            });
        });

        it('returns 200 and the correct metrics information when the project is running', async function() {
            if (process.env.JENKINS_HOME) {
                this.skip();
            }
            this.timeout(testTimeout.maxTravis);
            await projectService.awaitProjectStartedHTTP(projectID);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.containSubset({
                liveMetricsAvailable: true,
                metricsEndpoint: '/metrics',
                appmetricsEndpoint: '/javametrics-dash',
                projectRunning: true,
            });
        });

    });

    describe('Java Open Liberty project without javametrics-dash', function() {
        const projectName = `test-openliberty-project-metrics-no-java-dash-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('clone project and bind to PFE', async function() {
            this.timeout(testTimeout.med);
            await projectService.cloneProjectAndReplacePlaceholders(
                templateOptions['openliberty'].url,
                pathToLocalProject,
                projectName,
            );
            const { body: project } = await projectService.bindProject({
                name: projectName,
                path: pathToLocalProject,
                language: 'java',
                projectType: 'docker',
                creationTime: Date.now(),
            });
            projectID = project.projectID;
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and correct metrics information before the project is running', async function() {
            this.timeout(testTimeout.med);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.deep.equal({
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                microprofilePackageFoundInBuildFile: true,
                appmetricsPackageFoundInBuildFile: false,
                canMetricsBeInjected: true,
                projectRunning: false,
                hasTimedMetrics: false,
            });
        });

        it('returns 200 and the correct metrics information when the project is running', async function() {
            if (process.env.JENKINS_HOME) {
                this.skip();
            }
            this.timeout(testTimeout.maxTravis);
            await projectService.awaitProjectStartedHTTP(projectID);

            const res = await getMetricsStatus(projectID);
            res.status.should.equal(200, res.text);
            res.body.should.containSubset({
                liveMetricsAvailable: true,
                metricsEndpoint: '/metrics',
                appmetricsEndpoint: false,
                projectRunning: true,
            });
        });
    });
});

function getMetricsStatus(projectID) {
    return reqService.chai
        .get(`/api/v1/projects/${projectID}/metrics/status`)
        .set('cookie', ADMIN_COOKIE);
}
