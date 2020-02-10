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
const chaiSubset = require('chai-subset');
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const { 
    ADMIN_COOKIE,
    TEMP_TEST_DIR,
    testTimeout,
    pathToApiSpec,
} = require('../../../config');

chai.use(chaiSubset);
chai.use(chaiResValidator(pathToApiSpec));
chai.should();

const postMetricsInject = (projectID, options) => reqService.chai
    .post(`/api/v1/projects/${projectID}/metrics/inject`)
    .set('Cookie', ADMIN_COOKIE)
    .send(options);

describe('Metrics Inject tests (/api/v1/projects/{id}/metrics/inject)', function() {
    it('returns 404 to /metrics/inject when project does not exist', async function() {
        const projectID = '00000000-0000-0000-0000-000000000000';
        this.timeout(testTimeout.short);
        const res = await postMetricsInject(projectID, { enable: true });
        
        res.should.have.status(404);
        res.text.should.equal(`Unable to find project ${projectID}`);
    });
    
    describe('Node.js success case (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-node-metrics-inject-${Date.now()}`;
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
    
        it('returns 202 to /metrics/inject and starts injecting metrics into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsInject(projectID, { enable: true });
            res.should.have.status(202);
        
            const { body: project } = await projectService.getProject(projectID);
            project.should.containSubset({
                metricsAvailable: true,
                injectMetrics: true,
                injection: {
                    injectable: true,
                    injected: true,
                },
                isOpenLiberty: false,
                metricsDashboard: {
                    hosting: 'performanceContainer',
                    path: `/performance/monitor/dashboard/nodejs?theme=dark&projectID=${projectID}`,
                },
                perfDashboardPath: `/performance/charts?project=${projectID}`,
            });
        });
    
        it('returns 202 to /metrics/inject and starts removing injected metrics from the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsInject(projectID, { enable: false });
            res.should.have.status(202);
        
            const { body: project } = await projectService.getProject(projectID);
            project.should.containSubset({
                metricsAvailable: true,
                injectMetrics: false,
                injection: {
                    injectable: true,
                    injected: false,
                },
                isOpenLiberty: false,
                metricsDashboard: {
                    hosting: 'project',
                    path: `/appmetrics-dash?theme=dark`,
                },
                perfDashboardPath: `/performance/charts?project=${projectID}`,
            });
        });
    });
    
    describe('Java Liberty success case (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-liberty-metrics-inject-${Date.now()}`;
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
    
        it('returns 202 to /metrics/inject and starts injecting metrics into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsInject(projectID, { enable: true });
            res.should.have.status(202);
        
            const { body: project } = await projectService.getProject(projectID);
            project.should.containSubset({
                metricsAvailable: true,
                injectMetrics: true,
                injection: {
                    injectable: true,
                    injected: true,
                },
                isOpenLiberty: false,
                metricsDashboard: {
                    hosting: 'performanceContainer',
                    path: `/performance/monitor/dashboard/java?theme=dark&projectID=${projectID}`,
                },
                perfDashboardPath: `/performance/charts?project=${projectID}`,
            });
        });
    
        it('returns 202 to /metrics/inject and starts removing injected metrics from the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsInject(projectID, { enable: false });
            res.should.have.status(202);
        
            const { body: project } = await projectService.getProject(projectID);
            project.should.containSubset({
                metricsAvailable: true,
                injectMetrics: false,
                injection: {
                    injectable: true,
                    injected: false,
                },
                isOpenLiberty: false,
                metricsDashboard: {
                    hosting: 'project',
                    path: `/javametrics-dash?theme=dark`,
                },
                perfDashboardPath: `/performance/charts?project=${projectID}`,
            });
        });
    });
    
    describe('Java Open Liberty success case (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-open-liberty-metrics-inject-${Date.now()}`;
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
    
        it('returns 202 to /metrics/inject and starts injecting metrics into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsInject(projectID, { enable: true });
            res.should.have.status(202);
        
            const { body: project } = await projectService.getProject(projectID);
            project.should.containSubset({
                metricsAvailable: false,
                injectMetrics: true,
                injection: {
                    injectable: true,
                    injected: true,
                },
                isOpenLiberty: true,
                metricsDashboard: {
                    hosting: 'performanceContainer',
                    path: `/performance/monitor/dashboard/java?theme=dark&projectID=${projectID}`,
                },
                perfDashboardPath: `/performance/charts?project=${projectID}`,
            });
        });
    
        it('returns 202 to /metrics/inject and starts removing injected metrics from the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsInject(projectID, { enable: false });
            res.should.have.status(202);
        
            const { body: project } = await projectService.getProject(projectID);
            project.should.containSubset({
                metricsAvailable: false,
                injectMetrics: false,
                injection: {
                    injectable: true,
                    injected: false,
                },
                isOpenLiberty: true,
                metricsDashboard: {
                    hosting: 'performanceContainer',
                    path: `/performance/monitor/dashboard/java?theme=dark&projectID=${projectID}`,
                },
                perfDashboardPath: `/performance/charts?project=${projectID}`,
            });
        });
    });
});
