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
const { 
    ADMIN_COOKIE,
    TEMP_TEST_DIR, testTimeout,
    pathToApiSpec,
} = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Project file list tests (/projects/{id}/fileList)', function() {
    const projectName = `test-project-fileList-${Date.now()}`;
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

    describe('GET /projects/{id}/fileList', function() {
        const getProjectFileList = (projectID) => reqService.chai
            .get(`/api/v1/projects/${projectID}/fileList`)
            .set('Cookie', ADMIN_COOKIE);

        it('returns 200 and the list of files for this project', async function() {
            const res = await getProjectFileList(projectID);
            res.status.should.equal(200, res.text); 
            res.should.satisfyApiSpec;
            res.body.should.be.an('array');
            res.body.should.include('Dockerfile');
        });

        it('returns 404 when the given project does not exist', async function() {
            const res = await getProjectFileList('88888888-4444-4444-4444-121212121212');
            res.status.should.equal(404, res.text); 
        });
        it('returns 400 when the project id is not the correct formdoes not exist', async function() {
            const res = await getProjectFileList('blahblah-project');
            res.status.should.equal(400, res.text); 
        });
    });

});