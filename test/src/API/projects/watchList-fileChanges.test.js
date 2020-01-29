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

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');

const { ADMIN_COOKIE, testTimeout, TEMP_TEST_DIR } = require('../../../config');

chai.use(chaiSubset);
chai.should();

describe('watchList and file-changes route tests', function() {
    const projectName = `test-project-watchlist-filechanges-${Date.now()}`;
    const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
    const projectWatchStateId = 'foo';
    let projectID;
    
    before('create a sample project and bind to Codewind, without building', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
    });
    
    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToLocalProject, projectID);
    });

    describe('GET /projects/watchlist', function() {
        it('returns 200 and the watch info about the test project', async function() {
            this.timeout(testTimeout.med);
            const res = await projectService.getWatchList();
            
            res.should.have.status(200);
            const project = res.body.projects.find(project => project.projectID === projectID);
            project.should.containSubset({
                projectID,
                pathToMonitor: pathToLocalProject,
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
            });
        });
    });

    describe('PUT /projects/{id}/file-changes/{projectWatchStateId}/status', function() {
        const clientUuid = '0140d2f8f02545b162a79fa50fa3d7c1';
        
        it('returns 400 when req.body is missing `success`', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .put(`/api/v1/projects/${projectID}/file-changes/${projectWatchStateId}/status`)
                .set('Cookie', ADMIN_COOKIE)
                .query({ clientUuid });
            const res = await reqService.makeReq(req);
            
            res.should.have.status(400);
            res.text.should.equal('Error while validating request: request.body should have required property \'success\'');
        });

        it('returns 404 when the project does not eixst', async function() {
            this.timeout(testTimeout.med);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const req = () => reqService.chai
                .put(`/api/v1/projects/${idMatchingNoProjects}/file-changes/${projectWatchStateId}/status`)
                .set('Cookie', ADMIN_COOKIE)
                .query({ clientUuid })
                .send({ success: true });

            const res = await reqService.makeReq(req);
            res.should.have.status(404);
            res.text.should.equal(`Unable to find project ${idMatchingNoProjects}`);
        });
        
        it('returns 200 when the request is valid', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .put(`/api/v1/projects/${projectID}/file-changes/${projectWatchStateId}/status`)
                .set('Cookie', ADMIN_COOKIE)
                .query({ clientUuid })
                .send({ success: true });

            const res = await reqService.makeReq(req);
            res.should.have.status(200);
        });
    });
});
