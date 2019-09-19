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

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const config = require('../../../config');
const { ADMIN_COOKIE, testTimeout } = config;

chai.should();

describe.skip('Project Capabilities', function() {
    let projectID;
    const projectName = `projecttest${Date.now()}`;

    before('Create a project', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.createProjectAndAwaitID({ name: `${projectName}` });
    });

    after('Clean up by deleting project', async function() {
        this.timeout(testTimeout.med);
        await projectService.deleteProject(projectID);
    });

    describe('GET /{id}/capabilities', function() {
        it('should return a JSON object with the project capabilites', async function() {
            this.timeout(testTimeout.short);
            const res = await reqService.chai.get(`/api/v1/projects/${projectID}/capabilities`)
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(200);
            res.body.startModes.should.be.an('array');
            res.body.controlCommands.should.be.an('array');
        });
    });

    describe('GET /invalid project/capabilities', function() {
        it('should fail to get capabilities for an invalid project', async function() {
            this.timeout(testTimeout.short);
            const res = await reqService.chai.get('/api/v1/projects/invalidProjectID/capabilities')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(404);
        });
    });
});
