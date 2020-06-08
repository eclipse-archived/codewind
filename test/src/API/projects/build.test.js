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
const { 
    testTimeout,
    TEMP_TEST_DIR,
    pathToApiSpec,
} = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Project Build Tests', function() {
    const projectName = `test-project-build-${Date.now()}`;
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

    describe('POST projects/{id}/build', function() {
        it('returns 202 when `action` is `build`', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.buildProject(projectID, 'build');
            
            res.status.should.equal(202, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal(`Trying to build project ${projectID} with action build`);
        });
        
        it('returns 202 when `action` is `enableautobuild`', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.buildProject(projectID, 'enableautobuild');
            
            res.status.should.equal(202, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal(`Trying to build project ${projectID} with action enableautobuild`);
        });
        
        it('returns 202 when `action` is `disableautobuild`', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.buildProject(projectID, 'disableautobuild');
            
            res.status.should.equal(202, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal(`Trying to build project ${projectID} with action disableautobuild`);
        });
        
        it('returns 400 when `action` is unknown', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.buildProject(projectID, 'unknown action');
            
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal('Error while validating request: request.body.action should be equal to one of the allowed values');
        });
        
        it('returns 404 when project does not exist', async function() {
            this.timeout(testTimeout.short);
            const projectID = '00000000-0000-0000-0000-000000000000';
            const res = await projectService.buildProject(projectID, 'build');
            
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal(`Unable to find project ${projectID}`);
        });
    });
});
