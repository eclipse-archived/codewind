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
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');

const { testTimeout, TEMP_TEST_DIR, pathToApiSpec, ADMIN_COOKIE } = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('localDirDeleted API tests', function() {
    const projectName = `project-localdirdeleted${Date.now()}`;
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

    describe('Success cases for POST /projects/{id}/localDirDeleted', function() {
        it('emits the socket message when project exists', async function() {
            this.timeout(testTimeout.short);
            const req = () => reqService.chai
                .post(`/api/v1/projects/${projectID}/localDirDeleted`)
                .set(`Cookie`, ADMIN_COOKIE);
            const expectedSocketMessage = {
                projectID,
                msgType: 'localDirDeleted',
            };
            await reqService.makeReqAndAwaitSocketMsg(req, 200, expectedSocketMessage);
        });
    });

    describe('Fail cases for GET /projects/{id}/localDirDeleted', () => {
        it('returns 404 when project does not exist', async function() {
            this.timeout(testTimeout.short);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const req = await reqService.chai
                .post(`/api/v1/projects/${idMatchingNoProjects}/localDirDeleted`)
                .set(`Cookie`, ADMIN_COOKIE);
            req.status.should.equal(404);
        });
    });
});
