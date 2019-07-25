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

const projectService = require('../../modules/project.service');
const SocketService = require('../../modules/socket.service');
const reqService = require('../../modules/request.service');
const { promisify } = require('util');
const execAsync = promisify(require('child_process').exec);
const { ADMIN_COOKIE, testTimeout } = require('../../config');
const zlib = require('zlib');
const deflateAsync = promisify(zlib.deflate);

chai.should();

describe('watchList and file-changes route tests', function() {
    const projectName = `watchListProject${Date.now()}`;
    let socketService;
    let projectID;
    let projectWatchStateId;
    let workspace_location;
    before('Create a project', async function() {
        this.timeout(testTimeout.med);
        socketService = await SocketService.createSocket();
        workspace_location = await projectService.findWorkspaceLocation();
        const createOption = {
            projectName,
            url: 'https://github.com/microclimate-dev2ops/SVTPythonTemplate',
            parentPath: workspace_location,
        };
        const res = await projectService.createProjectFromTemplate(createOption);
        res.should.have.status(200);
        const bindOptions = {
            path: res.body.projectPath,
            name: projectName,
            language: 'python',
            projectType: 'docker',
            autoBuild: true,
        };
        await projectService.bindProjectAndWaitForMsg(bindOptions);
        projectID = await projectService.getProjectIdFromName(projectName);
        
    });

    after('Clean up by deleting project', async function() {
        this.timeout(testTimeout.med);
        const res = await projectService.unbindProject(projectID);
        res.should.have.status(202);
        await execAsync(`rm -rf ${workspace_location}/${projectName}`);
        socketService.close();
        socketService = null;
    });

    describe('GET /projects/watchlist', function() {

        it('should return the projectID just created', async function() {
            this.timeout(testTimeout.med);
            const projectArray = await projectService.getWatchList();
            projectArray.should.be.an('array');
            const project = projectArray.filter( el => {
                return el.projectID.toString().trim().toLowerCase() === projectID.toString().trim().toLowerCase();
            });
            project.length.should.deep.equal(1);
            project[0].should.be.an('object');
            const returnProjectID = project[0].projectID;
            returnProjectID.should.deep.equal(projectID);
            projectWatchStateId = project[0].projectWatchStateId;
            projectWatchStateId.should.be.a('string');
        });
    });

    describe('PUT /projects/{id}/file-changes/{projectWatchStateId}/status', function() {
        it('should return 400 errorStatus without status', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .put(`/api/v1/projects/${projectID}/file-changes/${projectWatchStateId}/status`)
                .set('Cookie', ADMIN_COOKIE);

            await reqService.makeReq(req, 400);
        });

        it('should return 404 errorStatus with invalid projectID', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .put(`/api/v1/projects/12345acde/file-changes/${projectWatchStateId}/status`)
                .set('Cookie', ADMIN_COOKIE)
                .send({ success: true });

            await reqService.makeReq(req, 404);
        });

        it('should receive the status of the projectWatchStateId', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .put(`/api/v1/projects/${projectID}/file-changes/${projectWatchStateId}/status`)
                .set('Cookie', ADMIN_COOKIE)
                .send({ success: true });

            const expectedSocketMsg = {
                projectID,
                msgType: 'projectWatchStatusChanged',
                expectedProperties: {
                    status: 'success',
                    projectWatchStateId,
                },
            };
            await reqService.makeReqAndAwaitSocketMsg(req, 200, expectedSocketMsg);
        });
    });

    describe('POST file-changes', function() {
        it('should return 400 errorStatus without msg', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .post(`/api/v1/projects/${projectID}/file-changes?timestamp=${Date.now()}&chunk=1&chunk_total=1`)
                .set('Cookie', ADMIN_COOKIE);

            await reqService.makeReq(req, 400);
        });

        it('should return 400 errorStatus without query', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .post(`/api/v1/projects/${projectID}/file-changes`)
                .set('Cookie', ADMIN_COOKIE)
                .send({ msg: 'hi' });

            await reqService.makeReq(req, 400);
        });


        it('should return 404 errorStatus with invalid projectID', async function() {
            this.timeout(testTimeout.med);
            const array = [{
                path: '/app.py' ,
                timestamp: Date.now(),
                type: 'MODIFY',
                directory: false,
            }];
            const str = JSON.stringify(array);
            const strBuffer = await deflateAsync(str);
            const base64Compressed = strBuffer.toString('base64');

            const req = () => reqService.chai
                .post(`/api/v1/projects/123456acde/file-changes?timestamp=${Date.now()}&chunk=1&chunk_total=1`)
                .set('Cookie', ADMIN_COOKIE)
                .send({ msg: base64Compressed });

            await reqService.makeReq(req, 404);
        });


        it('should return 500 errorStatus with invalid message', async function() {
            this.timeout(testTimeout.med);
            const req = () => reqService.chai
                .post(`/api/v1/projects/${projectID}/file-changes?timestamp=${Date.now()}&chunk=1&chunk_total=1`)
                .set('Cookie', ADMIN_COOKIE)
                .send({ msg: 'hi' });

            await reqService.makeReq(req, 500);
        });

        it('should trigger a build and receive projectChanged event', async function() {
            this.timeout(testTimeout.med);
            const array = [{
                path: '/app.py' ,
                timestamp: Date.now(),
                type: 'MODIFY',
                directory: false,
            }];
            await projectService.notifyPfeOfFileChangesAndAwaitMsg(array, projectID);
        });
    });


});

