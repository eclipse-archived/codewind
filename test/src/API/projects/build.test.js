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
const { testTimeout } = require('../../../config');

chai.should();

describe('Project Build Tests', function() {
    const projectName = `projectbuildtest${Date.now()}`;
    let projectID;

    before(async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.cloneAndBindProject(projectName, 'nodejs');
    });

    after(async function() {
        this.timeout(2 * testTimeout.med);
        await projectService.unbindProject(projectID);
        await projectService.deleteProjectDir(projectName);
    });

    describe('POST /{id}/build', function() {
        describe('valid request', function() {
            describe('id of an existing project', function() {
                it('returns 202 for an existing project', async function() {
                    this.timeout(testTimeout.short);
                    const res = await projectService.buildProject(projectID);
                    res.should.have.status(202);
                });
                /** 
                 * Currently, projects created with { autobuild: false } do not actually build.
                 * Issue raised at https://github.com/eclipse/codewind/issues/54
                 */
                it.skip('verifies that the project is now building', async function() {
                    this.timeout(testTimeout.short);
                    await projectService.awaitProjectBuilding(projectID);
                });
            });
        });
        describe('invalid request', function() {
            describe('id of a non-existent project', function() {
                it('returns 400', async function() {
                    this.timeout(testTimeout.short);
                    const res = await projectService.buildProject('non-existent');
                    res.should.have.status(400);
                });
            });
        });
    });
});
