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
const { testTimeout, TEMP_TEST_DIR, pathToApiSpec } = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Projects API tests', function() {
    describe('Success cases for GET /projects and GET /projects/:id', function() {
        let originalProjectIDs;
        let projectID;
        const projectName = `projectlist${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);

        it('returns a list of projectIDs', async function() {
            originalProjectIDs = await projectService.getProjectIDs();
            originalProjectIDs.should.be.an('array');
        });

        it('creates a project', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        });

        it('returns the same list but now including the extra projectID', async function() {
            const ids = await projectService.getProjectIDs();
            ids.should.be.an('array').with.members(originalProjectIDs.concat([projectID]));
        });
        
        it('returns the project', async function() {
            const res = await projectService.getProject(projectID);
            res.should.satisfyApiSpec;
            res.body.name.should.equal(projectName);
        });

        it('deletes the extra project', async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns the original list of projectIDs', async function() {
            const ids = await projectService.getProjectIDs();
            ids.should.be.an('array');
            ids.should.deep.equal(originalProjectIDs);
        });
    });
    
    describe('Fail cases for GET /project/{id}', () => {
        it('returns 404 when the project does not exist', async function() {
            this.timeout(testTimeout.short);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const res = await projectService.getProject(idMatchingNoProjects, 404);
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal('Not Found');
        });
    });
});
