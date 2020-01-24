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

const projectService = require('../../../modules/project.service');
const { testTimeout, TEMP_TEST_DIR } = require('../../../config');

chai.should();

describe('Project-list tests', function() {
    describe('GET /projects', function() {
        let originalProjectIDs;
        let projectID;
        const projectName = `projectlist${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);

        it('should return a list of projectIDs', async function() {
            originalProjectIDs = await projectService.getProjectIDs();
            originalProjectIDs.should.be.an('array');
        });

        it('should create a project', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        });

        it('should return the same list but now including the extra projectID', async function() {
            const ids = await projectService.getProjectIDs();
            ids.should.be.an('array').with.members(originalProjectIDs.concat([projectID]));
        });

        it('should delete the extra project', async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('should return the original list of projectIDs', async function() {
            const ids = await projectService.getProjectIDs();
            ids.should.be.an('array');
            ids.should.deep.equal(originalProjectIDs);
        });
    });
});
