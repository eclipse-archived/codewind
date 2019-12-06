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
const rewire = require('rewire');
const { mockReq, mockRes } = require('sinon-express-mock');

const projectsController = rewire('../../../../src/pfe/portal/controllers/projects.controller');
const ProjectList = require('../../../../src/pfe/portal/modules/ProjectList');
const { suppressLogOutput } = require('../../../modules/log.service');

chai.should();

describe('projects.controller.js', () => {
    suppressLogOutput(projectsController);
    describe('getProject(req, res)', () => {
        it('returns 404 if the specified project does not exist', async() => {
            const request = {
                sanitizeParams: () => 'nonexistentProjectId',
                cw_user: {
                    projectList: {
                        retrieveProject: () => {},
                    },
                },
            };
            const req = mockReq(request);
            const res = mockRes();

            await projectsController.getProject(req, res);

            res.sendStatus.should.be.calledOnceWith(404);
        });
        it('returns 500 if our server errors while parsing the request', async() => {
            const request = {};
            const req = mockReq(request);
            const res = mockRes();

            await projectsController.getProject(req, res);

            res.status.should.be.calledOnceWith(500);
            res.send.args[0][0].message.should.equal('req.sanitizeParams is not a function');
        });
        it('returns 200 and the project if the project ID is good', async() => {
            const projectList = new ProjectList();
            projectList.addProject(exampleProject);

            const request = {
                sanitizeParams: () => exampleProject.projectID,
                cw_user: { projectList },
            };
            const req = mockReq(request);
            const res = mockRes();

            await projectsController.getProject(req, res);

            res.status.should.be.calledOnceWith(200);
            res.send.args[0][0].should.deep.equal(exampleProject);
        });
    });
    describe('getProjects(req, res)', () => {
        it('returns 500 if our server errors while getting the project list', async() => {
            const request = {
                sanitizeParams: () => 'goodProjectID',
                cw_user: {},
            };
            const req = mockReq(request);
            const res = mockRes();

            await projectsController.getProjects(req, res);

            res.status.should.be.calledOnceWith(500);
            res.send.args[0][0].should.be.an('error');
        });
        it('returns 200 and a list of projects if there are no errors', async() => {
            const projectList = new ProjectList();
            projectList.addProject(exampleProject);

            const request = {
                sanitizeParams: () => exampleProject.projectID,
                cw_user: { projectList },
            };
            const req = mockReq(request);
            const res = mockRes();

            await projectsController.getProjects(req, res);

            res.status.should.be.calledOnceWith(200);
            res.send.args[0][0].should.deep.equal([exampleProject]);
        });
    });
});

const exampleProject = {
    projectID: '0e018aa0-1515-11ea-9063-896c05b47bde',
    name: 'node3',
    codewindVersion: 'latest',
    language: 'nodejs',
    locOnDisk: '/Users/richard.waller@ibm.com/codewind-workspace/node3',
    host: '172.18.0.5',
    ports: {
        exposedPort: '32771',
        internalPort: '3000',
        internalDebugPort: '9229',
    },
    workspace: '/codewind-workspace/',
    directory: 'node3',
    infLockFlag: false,
    loadTestPath: '/codewind-workspace/node3/load-test',
    projectType: 'nodejs',
    buildLogPath: '/codewind-workspace/.logs/node3-0e018aa0-1515-11ea-9063-896c05b47bde/docker.build.log',
    state: 'open',
    autoBuild: true,
    injectMetrics: 'true',
    buildStatus: 'success',
    detailedBuildStatus: ' ',
    projectWatchStateId: 'ea72093628ff9aa1904c2a8de89bf009',
    ignoredPaths: [
        '/.project',
        '/run-dev',
        '/run-debug',
        '/package-lock.json*',
        '/nodejs_restclient.log',
        '/nodejs_dc.log',
        '/manifest.yml',
        '/idt.js',
        '/cli-config.yml',
        '/README.md',
        '/Jenkinsfile',
        '/.cfignore',
        '/load-test*',
        '*/node_modules*',
        '*/.git/*',
        '*/.DS_Store',
        '*/*.swp',
        '*/*.swx',
        '*/4913',
        '*/.dockerignore',
        '*/.gitignore',
        '*/*~',
        '/.settings',
        '/chart',
    ],
    appStatus: 'started',
    detailedAppStatus: {
        severity: 'INFO',
        message: 'Application started.',
        notify: false,
    },
    lastbuild: 1575543700071,
    appImageLastBuild: '1575543689000',
    location: '/codewind-workspace/node3',
    validationStatus: 'success',
    validationResults: [],
    isHttps: false,
    containerId: '63d21ae7e283372c0ac40d90517b651e3cc52fdb0bbefc15c0321197d5e21f0b',
    logs: {
        build: [
            {
                origin: 'workspace',
                files: [
                    '/codewind-workspace/.logs/node3-0e018aa0-1515-11ea-9063-896c05b47bde/docker.build.log',
                ],
            },
        ],
        app: [
            {
                origin: 'workspace',
                files: [
                    '/codewind-workspace/.logs/node3-0e018aa0-1515-11ea-9063-896c05b47bde/app.log',
                ],
            },
        ],
    },
    metricsAvailable: true,
};
