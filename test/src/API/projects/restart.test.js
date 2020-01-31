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

describe('Project Restart Tests (POST /projects/{id}/restart)', function() {
    const projectName = `test-project-restart-${Date.now()}`;
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
    
    // Node can start in run, debug or debugNoInit modes.
    it('returns 400 when `restartMode` is `run` but project is still building', async function() {
        this.timeout(testTimeout.short);
        const res = await projectService.restartProject(projectID, 'run');
        
        res.should.have.status(400);
        res.should.satisfyApiSpec;
        res.body.message.should.equal(`Request error for project ${projectID}. Restart is invalid when the project is building.`);
    });
    
    // does not currently work due to issue https://github.com/eclipse/codewind/issues/1968
    it.skip('returns 400 when `restartMode` is `debug` but project is still building', async function() {
        this.timeout(testTimeout.short);
        const projectID = '022f9990-4375-11ea-9b24-c76506c783f7';
        const res = await projectService.restartProject(projectID, 'debug');
        
        res.should.have.status(400);
        res.should.satisfyApiSpec;
        res.body.message.should.equal(`Request error for project ${projectID}. Restart is invalid when the project is building.`);
    });
    
    it('returns 400 when `restartMode` is `debugNoInit` but project is still building', async function() {
        this.timeout(testTimeout.short);
        const res = await projectService.restartProject(projectID, 'debugNoInit');
        
        res.should.have.status(400);
        res.should.satisfyApiSpec;
        res.body.message.should.equal(`Request error for project ${projectID}. Restart is invalid when the project is building.`);
    });
    
    it.skip('returns 400 when `restartMode` is invalid', async function() {
        this.timeout(testTimeout.short);
        const res = await projectService.restartProject(projectID, 'unknownMode');
        
        res.should.have.status(400);
        res.text.should.equal('Error while validating request: request.body.startMode should be equal to one of the allowed values');
    });
    
    it('returns 404 when project does not exist', async function() {
        this.timeout(testTimeout.short);
        const projectID = '00000000-0000-0000-0000-000000000000';
        const res = await projectService.restartProject(projectID, 'run');

        res.should.have.status(404);
        res.should.satisfyApiSpec;
        res.body.msg.should.equal(`Unable to find project ${projectID}`);
    });
});
