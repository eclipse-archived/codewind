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
const { testTimeout } = require('../../config');

chai.should();

describe('Open/Close Project Tests', function() {
    let projectID;
    let socketService;

    before(async function() {
        this.timeout(testTimeout.med);
        socketService = await SocketService.createSocket();
        projectID = await projectService.cloneAndBindProject(`opencloseproject${Date.now()}`, 'nodejs');
    });

    after('Clean up by deleting this test\'s project', async function() {
        this.timeout(testTimeout.med);
        await projectService.unbindProject(projectID);
        socketService.close();
        socketService = null;
    });

    describe('PUT projects/{id}/close', function() {
        it('should start closing an open project', async function() {
            this.timeout(testTimeout.short);
            await projectService.closeProject(projectID, 202, false);
        });

        it('should fail to close a closing project', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.closeProject(projectID, 409);
            res.body.should.have.own.property('msg');
            res.body.msg.should.include('Already closing');
        });

        it.skip('should successfully finish closing the project', async function() {
            this.timeout(testTimeout.short);
            const expectedSocketMsg = { msgType: 'projectClosed', projectID };
            await socketService.checkForMsg(expectedSocketMsg);
        });

        it.skip('should fail to close a closed project', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.closeProject(projectID, 409);
            res.body.should.have.own.property('msg');
            res.body.msg.should.include('already closed');
        });

        it('should fail to close a non-existent project', async function() {
            this.timeout(testTimeout.short);
            await projectService.closeProject('non-existent-project', 404);
        });
    });

    describe('PUT projects/{id}/open', function() {
        it('should open a closed project', async function() {
            this.timeout(testTimeout.short);
            await projectService.openProject(projectID, 200);
        });

        it('should open an open project', async function() {
            this.timeout(testTimeout.short);
            await projectService.openProject(projectID, 200);
        });

        it('should fail to open an non-existent project', async function() {
            this.timeout(testTimeout.short);
            await projectService.openProject('non-existent-project', 404);
        });
    });
});
